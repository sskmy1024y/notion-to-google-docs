import { NotionBlock } from '../types';

export function processCodeBlock(
  block: NotionBlock,
  startIndex: number,
  extractTextFromRichText: (richText: any[]) => string
): { requests: any[]; textLength: number } {
  let text = extractTextFromRichText(block.code?.rich_text || []);
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
        updateTextStyle: {
          range: {
            startIndex: startIndex,
            endIndex: startIndex + text.length,
          },
          textStyle: {
            fontFamily: 'Consolas',
          },
          fields: 'fontFamily',
        },
      }
    );
    textLength = text.length + 1;
  }
  return { requests, textLength };
}
