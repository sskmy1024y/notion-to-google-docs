import { NotionBlock, BlockProcessResult } from '../types';

export function processQuoteBlock(
  block: NotionBlock,
  startIndex: number,
  extractTextFromRichText: (richText: any[]) => string
): BlockProcessResult {
  let text = extractTextFromRichText(block.quote?.rich_text || []);
  const requests: any[] = [];
  let textLength = 0;
  if (text) {
    requests.push(
      {
        insertText: {
          location: { index: startIndex },
          text: text + '\n',
        },
      },
      {
        updateParagraphStyle: {
          range: {
            startIndex: startIndex,
            endIndex: startIndex + text.length,
          },
          paragraphStyle: {
            indentStart: { magnitude: 36, unit: 'PT' },
            indentFirstLine: { magnitude: 36, unit: 'PT' },
          },
          fields: 'indentStart,indentFirstLine',
        },
      }
    );
    textLength = text.length + 1;
  }
  // 引用ブロックはインデントが必要ですが、即時更新は不要
  return { requests, textLength, updateImmediately: false };
}
