import { NotionBlock, BlockProcessResult } from '../types';
import { processChildBlock } from './block-child';

export async function processHeadingBlock(
  block: NotionBlock,
  startIndex: number,
  extractTextFromRichText: (richText: any[]) => string,
  requests: any[] = [],
  updateBatch?: (reqs: any[]) => Promise<any[]>,
  depth: number = 0
): Promise<BlockProcessResult> {
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
    
    // 見出しは文書構造の重要な要素なので、updateBatchが提供されている場合は即時更新する
    if (updateBatch && requests.length > 0) {
      // updateBatchを呼び出して、リクエストをすぐに適用
      requests = await updateBatch(requests);
    }

    const processChildBlockResults = await processChildBlock(
        block,
        startIndex + textLength,
        extractTextFromRichText,
        requests,
        updateBatch,
        depth + 1,
    );
    requests = processChildBlockResults.requests;
    textLength += processChildBlockResults.textLength;
  }
  
  return { requests, textLength, updateImmediately: true };
}
