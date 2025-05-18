import { NotionBlock } from '../types';

export function processListBlock(
  block: NotionBlock,
  startIndex: number,
  extractTextFromRichText: (richText: any[]) => string
): { requests: any[]; textLength: number } {
  let text = '';
  let bulletPreset = '';
  if (block.type === 'bulleted_list_item') {
    text = extractTextFromRichText(block.bulleted_list_item?.rich_text || []);
    bulletPreset = 'BULLET_DISC_CIRCLE_SQUARE';
  } else if (block.type === 'numbered_list_item') {
    text = extractTextFromRichText(block.numbered_list_item?.rich_text || []);
    bulletPreset = 'NUMBERED_DECIMAL';
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
        createParagraphBullets: {
          range: {
            startIndex: startIndex,
            endIndex: startIndex + text.length,
          },
          bulletPreset,
        },
      }
    );
    textLength = text.length + 1;
  }
  return { requests, textLength };
}
