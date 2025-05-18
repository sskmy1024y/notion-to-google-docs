import { matchProcess } from ".";
import { BlockProcessResult, NotionBlock } from "../types";

export async function processChildBlock(
  block: NotionBlock,
  startIndex: number,
  extractTextFromRichText: (richText: any[]) => string,
  requests: any[] = [],
  updateBatch?: (reqs: any[]) => Promise<any[]>,
  depth: number = 1
): Promise<BlockProcessResult> {
  let textLength = 0;

  // 子要素（ネストされたリストアイテム）を処理
  if (block.has_children && block.child_blocks && block.child_blocks.length > 0) {
    // 親リストアイテムの後に子要素を追加するので、開始インデックスをずらす
    let childStartIndex = startIndex + textLength;
    const indent = '\t'.repeat(depth); // インデントを追加

    for await (const childBlock of block.child_blocks) {
      const processFn = matchProcess(childBlock);
      if (!processFn) {
        console.warn(`No process function found for block type: ${childBlock.type}`);
        continue;
      }
      requests.push({
        insertText: {
          location: { index: childStartIndex },
          text: indent,
        },
      });
      textLength += indent.length; // タブを追加したので、テキスト長を更新
      childStartIndex += indent.length; // タブを追加したので、インデックスを1つ進める
      
      const processResult = await processFn(
        childBlock,
        childStartIndex,
        extractTextFromRichText,
        requests,
        updateBatch,
        depth + 1
      );
      requests = processResult.requests;
      textLength += processResult.textLength;
      childStartIndex += processResult.textLength;
    }
  }

  return {
    requests,
    textLength,
    updateImmediately: false
  }
}
