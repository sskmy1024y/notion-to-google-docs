import { matchProcess } from '.';
import { NotionBlock, BlockProcessResult } from '../types';
import { processChildBlock } from './block-child';

export async function processListBlock(
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
      }
    );
    textLength = text.length + 1;
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

  if (!isChildBlock) {
    requests.push({
      insertText: {
        location: { index: startIndex + textLength },
        text: '\n',
      },
    }, {
      createParagraphBullets: {
        range: {
          startIndex: startIndex,
          endIndex: startIndex + textLength,
        },
        bulletPreset,
      },
    }, {
      insertText: {
        location: { index: startIndex + textLength + 1 },
        text: '\n',
      },
    }, {
      deleteParagraphBullets: {
        range: {
          startIndex: startIndex,
          endIndex: startIndex + textLength,
        },
      },
    });
    // WARNING: リストアイテムに変換した際に、タブがインデントに変換されてテキスト長が変わる
    // 内部に含まれるインデント分のテキスト長を引く
    const count = getIndentCount(block, depth);
    textLength -= count;

    textLength += 2; // 改行を追加した分は加算
  }
  
  return { requests, textLength, updateImmediately: shouldUpdateImmediately };
}

const getIndentCount = (block: NotionBlock, depth: number = 0): number => {
  if (block.has_children && block.child_blocks) {
    const childrenCount = block.child_blocks.length;
    const indent = '\t'.repeat(depth + 1);
    const indentCount = childrenCount * indent.length;
    return block.child_blocks.reduce((acc, child) => acc + getIndentCount(child, depth + 1), indentCount);
  }
  return 0;
}
