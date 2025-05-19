import { NotionBlock, BlockProcessResult } from '../types';

export async function processCodeBlock(
  block: NotionBlock,
  startIndex: number,
  extractTextFromRichText: (richText: any[]) => string,
  requests: any[] = [],
  updateBatch?: (reqs: any[]) => Promise<any[]>
): Promise<BlockProcessResult> {
  let text = extractTextFromRichText(block.code?.rich_text || []);
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
            weightedFontFamily: {
              weight: 400,
              fontFamily: 'Consolas',
            },
          },
          fields: 'weightedFontFamily',
        },
      }
    );
    textLength = text.length + 1;
    
    // コードブロックは特殊なフォーマットが必要なため、updateBatchが提供されている場合は即時更新する
    if (updateBatch && requests.length > 0) {
      // updateBatchを呼び出して、リクエストをすぐに適用
      requests = await updateBatch(requests);
    }
  }
  
  // コードブロックは引き続き即時更新フラグを設定
  return { requests, textLength, updateImmediately: true };
}
