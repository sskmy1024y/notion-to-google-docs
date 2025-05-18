import { NotionBlock, BlockProcessResult } from '../types';

export async function processListBlock(
  block: NotionBlock,
  startIndex: number,
  extractTextFromRichText: (richText: any[]) => string,
  requests: any[] = [],
  updateBatch?: (reqs: any[]) => Promise<any[]>
): Promise<BlockProcessResult> {
  let text = '';
  let bulletPreset = '';
  let shouldUpdateImmediately = false;
  
  if (block.type === 'bulleted_list_item') {
    text = extractTextFromRichText(block.bulleted_list_item?.rich_text || []);
    bulletPreset = 'BULLET_DISC_CIRCLE_SQUARE';
  } else if (block.type === 'numbered_list_item') {
    text = extractTextFromRichText(block.numbered_list_item?.rich_text || []);
    bulletPreset = 'NUMBERED_DECIMAL_ALPHA_ROMAN';
  } else if (block.type === 'to_do') {
    text = extractTextFromRichText(block.to_do?.rich_text || []);
    bulletPreset = 'BULLET_CHECKBOX';
  }
  
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
    
    // 番号付きリストの場合は順序が重要なので、updateBatchが提供されている場合で番号付きリストの場合は即時更新する
    if (updateBatch && shouldUpdateImmediately && requests.length > 0) {
      // updateBatchを呼び出して、リクエストをすぐに適用
      requests = await updateBatch(requests);
    }
  }
  
  return { requests, textLength, updateImmediately: shouldUpdateImmediately };
}
