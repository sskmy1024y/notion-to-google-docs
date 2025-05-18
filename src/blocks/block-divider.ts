import { NotionBlock } from '../types';

export function processDividerBlock(
  block: NotionBlock,
  startIndex: number
): { requests: any[]; textLength: number } {
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
  };
}
