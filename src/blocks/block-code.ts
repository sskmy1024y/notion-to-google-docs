import { NotionBlock, BlockProcessResult } from '../types';

export function processCodeBlock(
  block: NotionBlock,
  startIndex: number,
  extractTextFromRichText: (richText: any[]) => string
): BlockProcessResult {
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
  // コードブロックは特殊なフォーマットが必要なため、即時更新する
  return { requests, textLength, updateImmediately: true };
}
