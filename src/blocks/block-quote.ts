import { NotionBlock, BlockProcessResult } from '../types';

export async function processQuoteBlock(
  block: NotionBlock,
  startIndex: number,
  extractTextFromRichText: (richText: any[]) => string,
  requests: any[] = [],
  updateBatch?: (reqs: any[]) => Promise<any[]>
): Promise<BlockProcessResult> {
  let text = extractTextFromRichText(block.quote?.rich_text || []);
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

    requests.push({
      insertText: {
        location: { index: startIndex + textLength },
        text: text + '\n',
      },
    }, {
      updateParagraphStyle: {
        paragraphStyle: {
          indentStart: { magnitude: 0, unit: 'PT' },
          indentFirstLine: { magnitude: 0, unit: 'PT' },
        },
        range: {
          startIndex: startIndex + textLength,
          endIndex: startIndex + textLength + 1,
        },
        fields: 'indentStart,indentFirstLine',
      },
    });
    textLength += 1;
  }
  // 引用ブロックはインデントが必要ですが、引き続き即時更新は不要
  return { requests, textLength, updateImmediately: false };
}
