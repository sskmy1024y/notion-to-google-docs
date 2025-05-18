import { NotionBlock, BlockProcessResult } from '../types';

export function processUnsupportedBlock(
  block: NotionBlock,
  startIndex: number
): BlockProcessResult {
  const text = `[Unsupported block type: ${block.type}]\n`;
  return {
    requests: [
      {
        insertText: {
          location: { index: startIndex },
          text,
        },
      },
    ],
    textLength: text.length,
    // サポートされていないブロックは単純なテキスト挿入なので即時更新は不要
    updateImmediately: false
  };
}
