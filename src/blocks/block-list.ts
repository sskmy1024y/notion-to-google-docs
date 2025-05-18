import { NotionBlock, BlockProcessResult } from '../types';

export function processListBlock(
  block: NotionBlock,
  startIndex: number,
  extractTextFromRichText: (richText: any[]) => string
): BlockProcessResult {
  let text = '';
  let bulletPreset = '';
  let shouldUpdateImmediately = false;
  
  if (block.type === 'bulleted_list_item') {
    text = extractTextFromRichText(block.bulleted_list_item?.rich_text || []);
    bulletPreset = 'BULLET_DISC_CIRCLE_SQUARE';
    // 箇条書きリストは即時更新しなくても良い
    shouldUpdateImmediately = false;
  } else if (block.type === 'numbered_list_item') {
    text = extractTextFromRichText(block.numbered_list_item?.rich_text || []);
    bulletPreset = 'NUMBERED_DECIMAL';
    // 番号付きリストは順序が重要なので即時更新する
    shouldUpdateImmediately = true;
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
  
  return { requests, textLength, updateImmediately: shouldUpdateImmediately };
}
