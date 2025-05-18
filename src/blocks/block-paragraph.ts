import { NotionBlock } from '../types';

export function processParagraphBlock(
  block: NotionBlock,
  startIndex: number,
  extractTextFromRichText: (richText: any[]) => string
): { requests: any[]; textLength: number } {
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
  // 子ブロックの処理は親で行う
  return { requests, textLength };
}
