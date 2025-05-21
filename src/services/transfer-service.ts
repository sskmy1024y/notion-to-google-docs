import { validateConfig, NOTION_DATABASE_ID, GOOGLE_DOC_ID, NOTION_PAGE_ID, FETCH_CHILD_DATABASES } from '../config';
import { NotionService } from '../notion';
import { GoogleDocsService } from '../google-docs';
import { TransferResult, MultiTransferResult, NotionBlock } from '../types';
import { selectMultipleNotionPages } from '../cli';
import { db } from '../database';
import { findChildDatabases } from '../utils/database-utils';

/**
 * 複数のNotionページをGoogle Docsに転送する
 */
export async function transferMultipleNotionPagesToGoogleDocs(
  directPageId?: string, 
  directDatabaseId?: string,
  fetchChildDatabases?: boolean
): Promise<MultiTransferResult> {
  try {
    // Validate environment variables
    validateConfig();
    
    console.log('Starting transfer from Notion to Google Docs...');
    
    // LowDBの初期化
    console.log('キャッシュデータベースを初期化しています...');
    await db.load();
    
    // Initialize services
    const notionService = new NotionService(true); // キャッシュ機能をオン
    console.log('Notionサービスが初期化されました（キャッシュ機能: ON）');
    
    // 動的認証でGoogleDocsServiceを作成
    const googleDocsService = await GoogleDocsService.createWithDynamicAuth(notionService);
    console.log('動的認証が完了しました。');
    
    // ページIDのリストを取得
    let pageIds: string[] = [];
    
    // 引数からページID指定を優先的に使用
    const useDatabaseId = directDatabaseId || NOTION_DATABASE_ID;
    
    if (directPageId) {
      console.log(`コマンドライン引数からページID（${directPageId}）を直接指定されました`);
      pageIds = [directPageId];
    } else if (NOTION_PAGE_ID) {
      console.log(`環境変数からページID（${NOTION_PAGE_ID}）が指定されています`);
      pageIds = [NOTION_PAGE_ID];
    } else if (useDatabaseId) {
      console.log(`Notionデータベース(${useDatabaseId})からページのリストを取得しています...`);
      const pages = await notionService.getDatabasePages(useDatabaseId);
      console.log(`${pages.length}個のページが見つかりました。`);
      
      // CLIで複数ページを選択
      pageIds = await selectMultipleNotionPages(pages);
      console.log(`選択されたページ数: ${pageIds.length}`);
    }
    
    if (pageIds.length === 0) {
      throw new Error('転送するページが指定されていません。');
    }
    
    console.log(`Google Doc ID: ${GOOGLE_DOC_ID}`);
    
    // 既に処理したページIDを追跡するためのセット
    const processedPageIds = new Set<string>();
    // 処理すべきページIDのキュー
    const pageQueue = [...pageIds];

    // 各ページを処理
    const results: TransferResult[] = [];
    let successCount = 0;
    let failedCount = 0;
    
    while (pageQueue.length > 0) {
      const pageId = pageQueue.shift()!;
      
      // 既に処理済みのページはスキップ
      if (processedPageIds.has(pageId)) {
        console.log(`ページID ${pageId} は既に処理済みのためスキップします`);
        continue;
      }
      
      // 処理済みとしてマーク
      processedPageIds.add(pageId);
      
      try {
        console.log(`\n処理中のページID: ${pageId}`);
        
        // Fetch Notion page (キャッシュ機能が組み込まれている)
        console.log('Notionページを取得中...');
        const notionPage = await notionService.getPage(pageId);
        console.log(`取得したNotionページ: "${notionPage.title}" (${notionPage.blocks.length}ブロック)`);

        // child_databaseブロックを検索して処理
        const childDatabases = findChildDatabases(notionPage.blocks);
        if (childDatabases.length > 0) {
          console.log(`このページには ${childDatabases.length} 個のchild_databaseブロックが含まれています`);
          
          // 環境変数または引数で指定された場合のみ処理する（デフォルトはfalse）
          const shouldFetchChildDatabases = fetchChildDatabases ?? FETCH_CHILD_DATABASES;
          
          if (shouldFetchChildDatabases) {
            console.log('child_databaseブロックの処理が有効になっています');
            
            for await (const dbBlock of childDatabases) {
              const databaseId = dbBlock.id.replace(/-/g, '');
              try {
                console.log(`child_database ID ${databaseId} のview pageを取得中...`);
                // データベースのページリストを取得
                const dbPages = await notionService.getDatabasePages(databaseId);
                console.log(`データベース内に ${dbPages.length} 個のページが見つかりました`);
                
                // 新しく見つかったページIDをキューに追加
                for (const dbPage of dbPages) {
                  if (!processedPageIds.has(dbPage.id) && !pageQueue.includes(dbPage.id)) {
                    console.log(`キューに新しいページを追加: "${dbPage.title}" (${dbPage.id})`);
                    pageQueue.push(dbPage.id);
                  }
                }
              } catch (error) {
                console.error(`child_database ID ${databaseId} の処理中にエラーが発生しました:`, error);
              }
            }
          } else {
            console.log('child_databaseブロックの処理はスキップされます（--fetch-child-db オプションで有効化できます）');
          }
        }
        
        // Write to Google Docs
        console.log('Google Docsに書き込み中...');
        const result = await googleDocsService.writeToDoc(notionPage);
        console.log(`Google Docへの書き込み成功: ${result.documentId}`);
        
        const transferResult: TransferResult = {
          success: true,
          message: `"${notionPage.title}" をNotionからGoogle Docsに転送しました`,
          notionPageId: notionPage.id,
          googleDocId: result.documentId
        };
        
        results.push(transferResult);
        successCount++;
      } catch (error) {
        console.error(`ページID ${pageId} の転送中にエラーが発生しました:`, error);
        
        const errorResult: TransferResult = {
          success: false,
          message: `NotionからGoogle Docsへの転送に失敗しました: ${error instanceof Error ? error.message : String(error)}`,
          notionPageId: pageId,
          error: error instanceof Error ? error : new Error(String(error))
        };
        
        results.push(errorResult);
        failedCount++;
      }
    }
    
    // 総合結果を返す
    return {
      success: failedCount === 0,
      message: `${processedPageIds.size}個のページ処理が完了しました。成功: ${successCount}, 失敗: ${failedCount}`,
      results,
      successCount,
      failedCount
    };
  } catch (error) {
    console.error('転送処理中に予期せぬエラーが発生しました:', error);
    
    return {
      success: false,
      message: `転送処理中に予期せぬエラーが発生しました: ${error instanceof Error ? error.message : String(error)}`,
      results: [],
      successCount: 0,
      failedCount: 0
    };
  }
}
