import { NotionBlock, BlockProcessResult } from '../types';

export async function processUnsupportedBlock(
  block: NotionBlock,
  startIndex: number,
  extractTextFromRichText: (richText: any[]) => string,
  requests: any[] = [],
  updateBatch?: (reqs: any[]) => Promise<any[]>
): Promise<BlockProcessResult> {
  const text = `[Unsupported block type: ${block.type}]\n`;
  
  requests.push({
    insertText: {
      location: { index: startIndex },
      text,
    },
  });
  
  return {
    requests,
    textLength: text.length,
    // サポートされていないブロックは単純なテキスト挿入なので即時更新は不要
    updateImmediately: false
  };
}
