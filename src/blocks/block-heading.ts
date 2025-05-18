import { NotionBlock, BlockProcessResult } from '../types';

export function processHeadingBlock(
  block: NotionBlock,
  startIndex: number,
  extractTextFromRichText: (richText: any[]) => string
): BlockProcessResult {
  let text = '';
  let style: 'HEADING_1' | 'HEADING_2' | 'HEADING_3' = 'HEADING_1';
  if (block.type === 'heading_1') {
    text = extractTextFromRichText(block.heading_1?.rich_text || []);
    style = 'HEADING_1';
  } else if (block.type === 'heading_2') {
    text = extractTextFromRichText(block.heading_2?.rich_text || []);
    style = 'HEADING_2';
  } else if (block.type === 'heading_3') {
    text = extractTextFromRichText(block.heading_3?.rich_text || []);
    style = 'HEADING_3';
  }
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
            namedStyleType: style,
          },
          fields: 'namedStyleType',
        },
      }
    );
    textLength = text.length + 1;
  }
  // 見出しは文書構造の重要な要素なので、即時更新する
  return { requests, textLength, updateImmediately: true };
}
