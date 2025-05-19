#!/usr/bin/env tsx

console.log('Script starting...');

import fs from 'fs';
import path from 'path';
import { validateConfig, NOTION_DATABASE_ID, GOOGLE_DOC_ID } from './config';
import { NotionService } from './notion';
import { GoogleDocsService } from './google-docs';
import { TransferResult, MultiTransferResult } from './types';
import { selectNotionPage, selectMultipleNotionPages } from './cli';
import { db } from './database';

// ログファイルパス
const LOG_FILE = path.join(process.cwd(), 'debug.log');

// ログ書き込み関数
function writeLog(message: string) {
  const timestamp = new Date().toISOString();
  fs.appendFileSync(LOG_FILE, `[${timestamp}] ${message}\n`);
}

// console.log, console.errorをフック
const origLog = console.log;
const origError = console.error;
console.log = (...args: any[]) => {
  origLog(...args);
  writeLog(args.map(a => (typeof a === 'string' ? a : JSON.stringify(a, null, 2))).join(' '));
};
console.error = (...args: any[]) => {
  origError(...args);
  writeLog('[ERROR] ' + args.map(a => (typeof a === 'string' ? a : JSON.stringify(a, null, 2))).join(' '));
};

/**
 * 複数のNotionページをGoogle Docsに転送する
 */
async function transferMultipleNotionPagesToGoogleDocs(): Promise<MultiTransferResult> {
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
    const googleDocsService = await GoogleDocsService.createWithDynamicAuth();
    console.log('動的認証が完了しました。');
    
    // ページIDのリストを取得
    let pageIds: string[] = [];
    
    if (NOTION_DATABASE_ID) {
      console.log(`Notionデータベース(${NOTION_DATABASE_ID})からページのリストを取得しています...`);
      const pages = await notionService.getDatabasePages();
      console.log(`${pages.length}個のページが見つかりました。`);
      
      // CLIで複数ページを選択
      pageIds = await selectMultipleNotionPages(pages);
      console.log(`選択されたページ数: ${pageIds.length}`);
    }
    
    console.log(`Google Doc ID: ${GOOGLE_DOC_ID}`);
    
    // 各ページを処理
    const results: TransferResult[] = [];
    let successCount = 0;
    let failedCount = 0;
    
    for (const pageId of pageIds) {
      try {
        console.log(`\n処理中のページID: ${pageId}`);
        
        // Fetch Notion page (キャッシュ機能が組み込まれている)
        console.log('Notionページを取得中...');
        const notionPage = await notionService.getPage(pageId);
        console.log(`取得したNotionページ: "${notionPage.title}" (${notionPage.blocks.length}ブロック)`);
        
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
      message: `${pageIds.length}個のページ処理が完了しました。成功: ${successCount}, 失敗: ${failedCount}`,
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

/**
 * Execute the script
 */
(async () => {
  try {
    // 複数ページ転送機能を使用
    const result = await transferMultipleNotionPagesToGoogleDocs();
    
    if (result.success) {
      console.log(`\n✅ ${result.message}`);
      
      // 各成功したページの詳細を表示
      result.results.filter(r => r.success).forEach(r => {
        console.log(`\n✓ ${r.message}`);
        console.log(`  Notion Page: ${r.notionPageId}`);
        console.log(`  Google Doc: ${r.googleDocId}`);
      });
      
      // 失敗したページがあれば表示
      if (result.failedCount > 0) {
        console.log(`\n⚠️ ${result.failedCount}個のページの転送に失敗しました:`);
        result.results.filter(r => !r.success).forEach(r => {
          console.log(`  ✗ ${r.notionPageId}: ${r.message}`);
        });
      }
      
      process.exit(0);
    } else {
      console.error(`\n❌ ${result.message}`);
      process.exit(1);
    }
  } catch (error) {
    console.error('Unhandled error:', error);
    process.exit(1);
  }
})();
