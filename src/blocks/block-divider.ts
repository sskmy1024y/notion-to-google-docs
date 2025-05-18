import { NotionBlock, BlockProcessResult } from '../types';

export async function processDividerBlock(
  block: NotionBlock,
  startIndex: number,
  extractTextFromRichText: (richText: any[]) => string,
  requests: any[] = [],
  updateBatch?: (reqs: any[]) => Promise<any[]>
): Promise<BlockProcessResult> {
  requests.push({
    insertText: {
      location: { index: startIndex },
      text: '---\n',
    },
  });
  
  // 区切り線は文書構造を分ける重要な要素なので、updateBatchが提供されている場合は即時更新
  if (updateBatch && requests.length > 0) {
    requests = await updateBatch(requests);
  }
  
  return {
    requests,
    textLength: 4, // 3 dashes + newline
    // 区切り線は引き続き即時更新フラグを設定
    updateImmediately: true
  };
}
