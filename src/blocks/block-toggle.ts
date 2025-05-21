import { matchProcess } from '.';
import { NotionBlock, BlockProcessResult } from '../types';
import { processChildBlock } from './block-child';

export async function processToggleBlock(
  block: NotionBlock,
  startIndex: number,
  extractTextFromRichText: (richText: any[]) => string,
  requests: any[] = [],
  updateBatch?: (reqs: any[]) => Promise<any[]>,
  depth: number = 0,
): Promise<BlockProcessResult> {
  let text = '';
  let bulletPreset = '';
  let shouldUpdateImmediately = false;
  const isChildBlock = depth > 0;
  
  if (block.type === 'toggle') {
    text = extractTextFromRichText(block.toggle?.rich_text || []);
    bulletPreset = 'BULLET_ARROW_DIAMOND_DISC';
  }
  
  let textLength = 0;
  if (text) {
    requests.push(
      {
        insertText: {
          location: { index: startIndex },
          text: text + '\n',
        },
      }, {
        createParagraphBullets: {
          range: {
            startIndex: startIndex,
            endIndex: startIndex + text.length,
          },
          bulletPreset,
        },
      }
    );
    textLength = isChildBlock ? text.length : text.length + 1;
  }
  
  const processChildBlockResults = await processChildBlock(
    block,
    startIndex + textLength - 1, // 先にcreateParagraphBulletsを追加しているので、-1する
    extractTextFromRichText,
    requests,
    updateBatch,
    depth + 1
  );
  requests = processChildBlockResults.requests;
  textLength += processChildBlockResults.textLength;

  if (!isChildBlock) {
    requests.push({
      insertText: {
        location: { index: startIndex + textLength },
        text: '\n',
      },
    })
    textLength += 1; // 改行を追加したので、テキスト長を更新
  }
  
  return { requests, textLength, updateImmediately: shouldUpdateImmediately };
}
