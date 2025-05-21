#!/usr/bin/env tsx

console.log('Script starting...');

import yargs from 'yargs/yargs';
import { hideBin } from 'yargs/helpers';
import { setupLogging } from './utils/logger';
import { transferMultipleNotionPagesToGoogleDocs } from './services/transfer-service';

// ロギングのセットアップ
setupLogging();

// コマンドライン引数の解析
const argv = yargs(hideBin(process.argv))
  .option('page', {
    alias: 'p',
    type: 'string',
    description: 'Notion page ID to transfer directly'
  })
  .option('database', {
    alias: 'd',
    type: 'string',
    description: 'Notion database ID to fetch pages from'
  })
  .option('fetch-child-db', {
    alias: 'f',
    type: 'boolean',
    description: 'Fetch and process child databases',
    default: false
  })
  .help()
  .alias('help', 'h')
  .parseSync();

/**
 * Execute the script
 */
(async () => {
  try {
    // 複数ページ転送機能を使用
    const result = await transferMultipleNotionPagesToGoogleDocs(
      argv.page,
      argv.database,
      argv['fetch-child-db']
    );
    
    if (result.success) {
      console.log(`\n✅ ${result.message}`);
      
      // 各成功したページの詳細を表示
      result.results.filter(r => r.success).forEach(r => {
        console.log(`\n✓ ${r.message}`);
        console.log(`  Notion Page: https://notion.so/${r.notionPageId}`);
        console.log(`  Google Doc: https://docs.google.com/document/d/${r.googleDocId}/edit`);
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
