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
    
    // 引用は通常は即時更新しないが、特定の条件でupdateBatchを呼び出すことも可能
    // if (updateBatch && text.length > 500) {
    //   requests = await updateBatch(requests);
    // }
  }
  // 引用ブロックはインデントが必要ですが、引き続き即時更新は不要
  return { requests, textLength, updateImmediately: false };
}
