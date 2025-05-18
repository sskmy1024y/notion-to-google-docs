import { NotionBlock, BlockProcessResult, BlockProcessFunction } from '../types';
import { processChildBlock } from './block-child';

export const processParagraphBlock: BlockProcessFunction = async (
  block: NotionBlock,
  startIndex: number,
  extractTextFromRichText: (richText: any[]) => string,
  requests: any[] = [],
  updateBatch?: (reqs: any[]) => Promise<any[]>,
  depth: number = 0
) => {
  let text = extractTextFromRichText(block.paragraph?.rich_text || []);
  let textLength = 0;
  
  if (text) {
    requests.push({
      insertText: {
        location: { index: startIndex },
        text: text + '\n',
      },
    });
    textLength = text.length + 1;
  }

  const processChildBlockResults = await processChildBlock(
    block,
    startIndex + textLength,
    extractTextFromRichText,
    requests,
    updateBatch,
    depth // 文字列の場合は自動でネストされるためそのまま渡す
  );
  requests = processChildBlockResults.requests;
  textLength += processChildBlockResults.textLength;
  
  return { requests, textLength, updateImmediately: false };
}
