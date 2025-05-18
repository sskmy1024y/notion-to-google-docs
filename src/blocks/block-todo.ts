import { NotionBlock, BlockProcessResult } from '../types';

export async function processToDoBlock(
  block: NotionBlock,
  startIndex: number,
  extractTextFromRichText: (richText: any[]) => string,
  requests: any[] = [],
  updateBatch?: (reqs: any[]) => Promise<any[]>
): Promise<BlockProcessResult> {
  let text = extractTextFromRichText(block.to_do?.rich_text || []);
  let textLength = 0;
  if (text) {
    requests.push({
      insertText: {
        location: { index: startIndex },
        text: `☐ ${text}\n`,
      },
    });
    textLength = text.length + 3; // ☐+スペース+改行
    
    // 特定の条件でupdateBatchを呼び出すことも可能
    // if (updateBatch && 特定の条件) {
    //   requests = await updateBatch(requests);
    // }
  }
  // 即時更新は不要
  return { requests, textLength, updateImmediately: false };
}
