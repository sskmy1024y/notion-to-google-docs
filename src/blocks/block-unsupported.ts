import { NotionBlock } from '../types';

export function processUnsupportedBlock(
  block: NotionBlock,
  startIndex: number
): { requests: any[]; textLength: number } {
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
  };
}
