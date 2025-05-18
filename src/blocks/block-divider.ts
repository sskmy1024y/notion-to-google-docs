import { NotionBlock, BlockProcessResult } from '../types';

export function processDividerBlock(
  block: NotionBlock,
  startIndex: number
): BlockProcessResult {
  return {
    requests: [
      {
        insertText: {
          location: { index: startIndex },
          text: '---\n',
        },
      },
    ],
    textLength: 4, // 3 dashes + newline
    // 区切り線は文書構造を分ける重要な要素なので即時更新
    updateImmediately: true
  };
}
