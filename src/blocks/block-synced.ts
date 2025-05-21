import { NotionBlock, BlockProcessResult } from '../types';
import { matchProcess } from './index';

export async function processSyncedBlock(
  block: NotionBlock,
  startIndex: number,
  extractTextFromRichText: (richText: any[]) => string,
  requests: any[] = [],
  updateBatch?: (reqs: any[]) => Promise<any[]>,
  depth: number = 0
): Promise<BlockProcessResult> {
  let textLength = 0;
  
  // 同期ブロックから参照先のブロックIDを取得
  const syncedFromBlockId = block.synced_block?.synced_from?.block_id;
  
  // 参照先のブロックIDが存在する場合
  if (syncedFromBlockId) {
    try {
      // NotionServiceのインスタンスを直接作成するのではなく、
      // 外部から渡された関数を使用してブロックを取得
      // これはクラスの依存関係を避けるためのアプローチ
      const getPageBlocksFn = (block as any).__getPageBlocks;
      
      if (typeof getPageBlocksFn === 'function') {
        // 参照先のブロックを取得
        const syncedBlocks = await getPageBlocksFn(syncedFromBlockId);
        
        if (syncedBlocks && syncedBlocks.length > 0) {
          // 同期先のブロックを処理
          for (const syncedBlock of syncedBlocks) {
            const processFn = matchProcess(syncedBlock);
            if (processFn) {
              const result = await processFn(
                syncedBlock,
                startIndex + textLength,
                extractTextFromRichText,
                requests,
                updateBatch,
                depth
              );
              
              requests = result.requests;
              textLength += result.textLength;
            }
          }

          requests.push({
            insertText: {
              location: { index: startIndex + textLength },
              text: '\n',
            },
          });
          textLength += 1;
          
          return {
            requests,
            textLength,
            updateImmediately: false
          };
        }
      }
      
      // 関数が存在しない場合や、ブロックが取得できなかった場合は
      // 下のエラーハンドリングと同じ処理を行う
    } catch (error) {
      console.error(`Error processing synced block (${syncedFromBlockId}):`, error);
    }
  }
  
  // エラーがあった場合や、参照先のブロックが取得できなかった場合は
  // エラーメッセージを表示
  const errorText = `[同期ブロック: ${syncedFromBlockId || '不明なID'}]\n`;
  requests.push({
    insertText: {
      location: { index: startIndex },
      text: errorText,
    },
  }, {
    insertText: {
      location: { index: startIndex + errorText.length },
      text: '\n',
    },
  });
  
  return {
    requests,
    textLength: errorText.length + 1,
    updateImmediately: false
  };
}
