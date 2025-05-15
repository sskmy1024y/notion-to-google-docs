#!/usr/bin/env tsx

console.log('Script starting...');

import { validateConfig, NOTION_PAGE_ID, NOTION_DATABASE_ID, GOOGLE_DOC_ID, NEEDS_DYNAMIC_AUTH } from './config';
import { NotionService } from './notion';
import { GoogleDocsService } from './google-docs';
import { TransferResult } from './types';
import { selectNotionPage } from './cli';

/**
 * Main function to transfer content from Notion to Google Docs
 */
async function transferNotionToGoogleDocs(): Promise<TransferResult> {
  try {
    // Validate environment variables
    validateConfig();
    
    console.log('Starting transfer from Notion to Google Docs...');
    
    // Initialize services
    const notionService = new NotionService();
    
    // GoogleDocsServiceの初期化方法を決定
    let googleDocsService;
    if (NEEDS_DYNAMIC_AUTH) {
      console.log('リフレッシュトークンが見つかりません。動的認証を開始します...');
      // 動的認証でGoogleDocsServiceを作成
      googleDocsService = await GoogleDocsService.createWithDynamicAuth();
      console.log('動的認証が完了しました。');
    } else {
      // 既存の静的認証情報でGoogleDocsServiceを作成
      googleDocsService = new GoogleDocsService();
    }
    
    // ページIDの取得方法を決定
    let pageId: string;
    
    if (NOTION_DATABASE_ID) {
      console.log(`Notionデータベース(${NOTION_DATABASE_ID})からページのリストを取得しています...`);
      const pages = await notionService.getDatabasePages();
      console.log(`${pages.length}個のページが見つかりました。`);
      
      // CLIでページを選択
      pageId = await selectNotionPage(pages);
      console.log(`選択されたページID: ${pageId}`);
    } else {
      // 環境変数からページIDを使用
      pageId = NOTION_PAGE_ID;
      console.log(`Notion Page ID: ${pageId}`);
    }
    
    console.log(`Google Doc ID: ${GOOGLE_DOC_ID}`);
    
    // Fetch Notion page
    console.log('Fetching Notion page...');
    const notionPage = await notionService.getPage(pageId);
    console.log(`Fetched Notion page: "${notionPage.title}" with ${notionPage.blocks.length} blocks`);
    
    // Write to Google Docs
    console.log('Writing to Google Docs...');
    const result = await googleDocsService.writeToDoc(notionPage);
    console.log(`Successfully wrote to Google Doc: ${result.documentId}`);
    
    return {
      success: true,
      message: `Successfully transferred "${notionPage.title}" from Notion to Google Docs`,
      notionPageId: notionPage.id,
      googleDocId: result.documentId
    };
  } catch (error) {
    console.error('Error transferring from Notion to Google Docs:', error);
    
    return {
      success: false,
      message: `Failed to transfer from Notion to Google Docs: ${error instanceof Error ? error.message : String(error)}`,
      error: error instanceof Error ? error : new Error(String(error))
    };
  }
}

/**
 * Execute the script
 */
(async () => {
  try {
    const result = await transferNotionToGoogleDocs();
    
    if (result.success) {
      console.log(`✅ ${result.message}`);
      console.log(`Notion Page: ${result.notionPageId}`);
      console.log(`Google Doc: ${result.googleDocId}`);
      process.exit(0);
    } else {
      console.error(`❌ ${result.message}`);
      process.exit(1);
    }
  } catch (error) {
    console.error('Unhandled error:', error);
    process.exit(1);
  }
})();
