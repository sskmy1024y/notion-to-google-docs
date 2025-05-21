import { NotionBlock } from '../types';

/**
 * NotionBlockの配列から、child_databaseタイプのブロックを再帰的に検索して返す
 * @param blocks - 検索対象のNotionBlockの配列
 * @returns child_databaseタイプのブロックの配列
 */
export function findChildDatabases(blocks: NotionBlock[]): NotionBlock[] {
  const childDatabases: NotionBlock[] = [];
  
  // ブロック配列を再帰的に探索
  for (const block of blocks) {
    // child_databaseタイプのブロックを見つけた場合、結果に追加
    if (block.type === 'child_database') {
      childDatabases.push(block);
    }
    
    // 子ブロックがある場合は、再帰的に検索
    if (block.child_blocks && Array.isArray(block.child_blocks) && block.child_blocks.length > 0) {
      const nestedChildDatabases = findChildDatabases(block.child_blocks);
      childDatabases.push(...nestedChildDatabases);
    }
  }
  
  return childDatabases;
}
