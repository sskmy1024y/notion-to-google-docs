import { NotionBlock, BlockProcessResult } from '../types';

/**
 * テーブルブロックを処理する関数
 * tableブロックは行や列の数、ヘッダーがあるかどうかなどの概要情報のみを持つ
 * 実際の内容はtable_rowブロックの子要素として取得する必要がある
 */
export function processTableBlock(
  block: NotionBlock,
  startIndex: number
): BlockProcessResult {
  const requests: any[] = [];
  let textLength = 0;

  if (block.type === 'table') {
    const table = block.table;
    const rowCount = table?.rows || 0;
    const columnCount = table?.width || 0;
    const hasColumnHeader = table?.has_column_header || false;

    if (rowCount > 0 && columnCount > 0) {
      // テーブル作成リクエスト
      requests.push({
        insertTable: {
          rows: rowCount,
          columns: columnCount,
          location: {
            index: startIndex
          }
        }
      });

      // テーブルの後に改行を追加
      requests.push({
        insertText: {
          text: '\n',
          location: {
            index: startIndex + 1 // テーブルの後の位置
          }
        }
      });

      // テーブルの長さは実際のセル内容によって変わるが、
      // テーブルとその後の改行で最低2文字分の長さを確保
      textLength = 2;
    }
  }

  // テーブルは即時更新が必要なのでtrueを返す
  return { requests, textLength, updateImmediately: true };
}

/**
 * 個別のテーブル行ブロックを処理する関数
 * この関数はテーブルが挿入された後に呼び出される
 */
export function processTableRowBlock(
  block: NotionBlock,
  tableRowIndex: number,
  tableStartIndex: number,
  extractTextFromRichText: (richText: any[]) => string
): { requests: any[] } {
  const requests: any[] = [];

  if (block.type === 'table_row') {
    const cells = block.table_row?.cells || [];

    for (let columnIndex = 0; columnIndex < cells.length; columnIndex++) {
      const cell = cells[columnIndex];
      const cellText = cell.map((richText: any) => extractTextFromRichText([richText])).join('');

      // テーブルセルにテキストを挿入（空のセルの場合でも半角スペースを挿入）
      requests.push({
        insertText: {
          text: cellText || ' ', // 空の場合は半角スペースを挿入
          location: {
            tableCell: {
              tableStartLocation: {
                index: tableStartIndex
              },
              rowIndex: tableRowIndex,
              columnIndex: columnIndex
            }
          }
        }
      });
    }
    
    // セルがない場合（全ての列が空の場合）でも、少なくとも1つのリクエストを確保
    if (requests.length === 0) {
      requests.push({
        insertText: {
          text: ' ', // 半角スペース
          location: {
            tableCell: {
              tableStartLocation: {
                index: tableStartIndex
              },
              rowIndex: tableRowIndex,
              columnIndex: 0 // 最初の列
            }
          }
        }
      });
    }
  }

  return { requests };
}
