import { NotionBlock, BlockProcessResult, BlockProcessFunction } from '../types';

export const processParagraphBlock: BlockProcessFunction = (
  block: NotionBlock,
  startIndex: number,
  extractTextFromRichText: (richText: any[]) => string,
  requests: any[] = [],
  updateBatch?: (reqs: any[]) => Promise<any[]>
) => {
  let text = extractTextFromRichText(block.paragraph?.rich_text || []);
  let textLength = 0;
  
  if (text) {
    requests.push({
      insertText: {
        location: { index: startIndex },
        text: text + '\n',
      },
    });
    textLength = text.length + 1;
    
    // updateBatchが提供され、特定の条件を満たす場合は即時更新することも可能
    // 例：テキストが特定のサイズを超える場合など
    // if (updateBatch && text.length > 1000) {
    //   requests = await updateBatch(requests);
    // }
  }
  
  return { requests, textLength, updateImmediately: false };
}
