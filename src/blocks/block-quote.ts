import { NotionBlock } from '../types';

export function processQuoteBlock(
  block: NotionBlock,
  startIndex: number,
  extractTextFromRichText: (richText: any[]) => string
): { requests: any[]; textLength: number } {
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
  return { requests, textLength };
}
