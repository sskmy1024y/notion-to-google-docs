import { NotionBlock, BlockProcessResult } from '../types';

export function processParagraphBlock(
  block: NotionBlock,
  startIndex: number,
  extractTextFromRichText: (richText: any[]) => string
): BlockProcessResult {
  let text = extractTextFromRichText(block.paragraph?.rich_text || []);
  const requests: any[] = [];
  let textLength = 0;
  if (text) {
    requests.push({
      insertText: {
        location: { index: startIndex },
        text: text + '\n',
      },
    });
    textLength = text.length + 1;
  }
  // 基本的にはすぐに更新する必要はない
  return { requests, textLength, updateImmediately: false };
}
