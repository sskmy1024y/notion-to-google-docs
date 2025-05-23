import { docs_v1 } from "googleapis";
import { BlockProcessFunction, BlockProcessResult, NotionBlock } from "../types";
import { matchProcess } from "./index";

/**
 * column_listブロックを処理する関数
 * このブロックは複数のカラムを含み、各カラムには複数の子ブロックが含まれる可能性がある
 */
export const processColumnListBlock: BlockProcessFunction = async (
  block: NotionBlock,
  startIndex: number,
  extractTextFromRichText: (richText: any[]) => string,
  requests?: any[],
  updateBatch?: (reqs: any[]) => Promise<any[]>,
  depth?: number
) => {
  const requestsArray: docs_v1.Schema$Request[] = requests || [];
  let currentIndex = startIndex;

  // column_listブロック自体は視覚的なコンテナなので、まずセクションの開始を示すための視覚的な区切りを追加
  requestsArray.push({
    insertText: {
      location: {
        index: currentIndex,
      },
      text: "\n",
    },
  });
  currentIndex += 1;

  // column_listの子ブロック（カラム）を処理
  if (block.column_list && block.column_list.children && block.column_list.children.length > 0) {
    // 各カラムを処理
    for (const columnBlock of block.column_list.children) {
      if (columnBlock.type === "column" && columnBlock.column && columnBlock.column.children) {
        // 各カラム内の子ブロックを処理
        for (const childBlock of columnBlock.column.children) {
          const processFunction = matchProcess(childBlock);
          const childResult = await processFunction(
            childBlock, 
            currentIndex, 
            extractTextFromRichText,
            requestsArray,
            updateBatch,
            (depth || 0) + 1
          );
          
          // 現在の位置を更新
          currentIndex += childResult.textLength;
        }
      }
    }
  }

  // カラムリストの終了後に追加の改行を入れて視覚的に分離
  requestsArray.push({
    insertText: {
      location: {
        index: currentIndex,
      },
      text: "\n",
    },
  });
  currentIndex += 1;

  return {
    requests: requestsArray,
    textLength: currentIndex - startIndex
  };
};
