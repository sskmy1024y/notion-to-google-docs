import { NotionBlock, BlockProcessResult } from '../types';

export function processToDoBlock(
  block: NotionBlock,
  startIndex: number,
  extractTextFromRichText: (richText: any[]) => string
): BlockProcessResult {
  let text = extractTextFromRichText(block.to_do?.rich_text || []);
  const requests: any[] = [];
  let textLength = 0;
  if (text) {
    requests.push({
      insertText: {
        location: { index: startIndex },
        text: `☐ ${text}\n`,
      },
    });
    textLength = text.length + 3; // ☐+スペース+改行
  }
  // 即時更新は不要
  return { requests, textLength, updateImmediately: false };
}
