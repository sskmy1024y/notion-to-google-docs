import { BlockProcessResult, NotionBlock, NotionTableBlock, NotionTableRowBlock, NotionText } from '../types';

/**
 * テーブルブロックを処理する関数
 * tableブロックは行や列の数、ヘッダーがあるかどうかなどの概要情報のみを持つ
 * 実際の内容はtable_rowブロックの子要素として取得する必要がある
 */
export async function processTableBlock(
  block: NotionBlock,
  startIndex: number,
  extractTextFromRichText: (richText: any[]) => string,
  requests: any[] = [],
  updateBatch?: (reqs: any[]) => Promise<any[]>,
): Promise<BlockProcessResult> {
  let textLength = 0;

  if (block.type !== 'table' || !updateBatch) {
    // 事前条件チェック
    return Promise.resolve({
      requests,
      textLength,
      updateImmediately: false
    });
  }

  const table = block.table as NotionTableBlock['table']
  const rowCount = block.child_blocks?.length || 0;
  const columnCount = table?.table_width || 0;
  const hasColumnHeader = table?.has_column_header || false;
  const hasRowHeader = table?.has_row_header || false;

  if (rowCount <= 0 || columnCount <= 0) {
    // 行数または列数が0の場合は何もしない
    return Promise.resolve({
      requests,
      textLength,
      updateImmediately: false
    });
  }


  // テーブルの後に改行を追加
  requests.push({
    insertText: {
      text: '\n',
      location: {
        index: startIndex
      }
    }
  });

  let tableIndex = startIndex + 1; // テーブルの前に改行を追加したので、インデックスを1つ進める

  // テーブル作成リクエスト
  requests.push({
    insertTable: {
      rows: rowCount,
      columns: columnCount,
      location: {
        index: tableIndex
      }
    }
  });

  tableIndex += 1; // テーブルのインデックスを進める
  
  // テーブルのセル位置を追跡するための配列
  // cellPositions[rowIndex][colIndex] = セルの開始インデックス
  const cellPositions: number[][] = Array(rowCount).fill(0).map(() => Array(columnCount).fill(0));

  // 行を追加するときはインデックスを1つ進める
  const nextRowIndex = 1;
  // セル + コンテンツの分インデックスを進める
  const nextCellIndex = 1 + 1;

  // テーブルの各行を処理
  if (block.child_blocks && block.child_blocks.length > 0) {
    // テーブルの各行のセルにテキストを挿入
    for (let rowIndex = 0; rowIndex < rowCount; rowIndex++) {
      const rowBlock = block.child_blocks[rowIndex] as NotionTableRowBlock;
      
      if (rowBlock.type !== 'table_row') {
        continue;
      }
      
      const cells = rowBlock.table_row.cells;

      // 1行分のインデックスを進める
      tableIndex += nextRowIndex;
      
      // この行の各セルにテキストを挿入
      for (let colIndex = 0; colIndex < columnCount; colIndex++) {
        // セルの開始インデックスを追加
        tableIndex += nextCellIndex;

        // セル位置を記録
        cellPositions[rowIndex][colIndex] = tableIndex;
        
        // セルのテキストを取得（セルが存在しない場合は空文字）
        const cellTexts: NotionText[] = colIndex < cells.length ? cells[colIndex] : [];
        let cellContent = '';
        let lastEndIndex = 0;
        
        // セル内のリッチテキスト要素を処理
        for (const textObj of cellTexts) {
          if (textObj.text && textObj.text.content) {
            cellContent += textObj.text.content;
            
            // セルのテキストスタイルを適用（太字、斜体など）
            if (textObj.text.annotations) {
              const annotations = textObj.text.annotations;
              const startIndex = tableIndex + lastEndIndex;
              const endIndex = startIndex + textObj.text.content.length;
              
              // テキストスタイルを設定するリクエストを作成
              const textStyleRequest = createTextStyleRequest(startIndex, endIndex, annotations);
              if (textStyleRequest) {
                requests.push(textStyleRequest);
              }
              
              lastEndIndex += textObj.text.content.length;
            }
          }
        }
        
        // セルにテキストを挿入するリクエスト
        if (cellContent) {
          requests.push({
            insertText: {
              text: cellContent,
              location: {
                index: tableIndex
              }
            }
          });
          
          // テーブルインデックスを更新
          tableIndex += cellContent.length;
        }
      }
    }
    
    // ヘッダー行の処理（1行目を太字にする）
    if (hasColumnHeader && block.child_blocks.length > 0) {
      const headerRow = block.child_blocks[0] as NotionTableRowBlock;
      if (headerRow.type === 'table_row') {
        for (let colIndex = 0; colIndex < columnCount; colIndex++) {
          const cellStartIndex = cellPositions[0][colIndex];
          
          // セルのテキスト長を計算
          let cellLength = 0;
          if (colIndex < headerRow.table_row.cells.length) {
            const cellTexts = headerRow.table_row.cells[colIndex];
            cellLength = cellTexts.reduce((acc, text) => acc + (text.text?.content?.length || 0), 0);
          }
          
          if (cellLength > 0) {
            requests.push({
              updateTextStyle: {
                range: {
                  startIndex: cellStartIndex,
                  endIndex: cellStartIndex + cellLength
                },
                textStyle: {
                  bold: true
                },
                fields: 'bold'
              }
            });
          }
        }
      }
    }
    
    // ヘッダー列の処理（各行の1列目を太字にする）
    if (hasRowHeader && columnCount > 0) {
      for (let rowIndex = 0; rowIndex < rowCount; rowIndex++) {
        const rowBlock = block.child_blocks[rowIndex] as NotionTableRowBlock;
        if (rowBlock.type === 'table_row' && rowBlock.table_row.cells.length > 0) {
          const cellStartIndex = cellPositions[rowIndex][0];
          
          // セルのテキスト長を計算
          let cellLength = 0;
          const cellTexts = rowBlock.table_row.cells[0];
          cellLength = cellTexts.reduce((acc, text) => acc + (text.text?.content?.length || 0), 0);
          
          if (cellLength > 0) {
            requests.push({
              updateTextStyle: {
                range: {
                  startIndex: cellStartIndex,
                  endIndex: cellStartIndex + cellLength
                },
                textStyle: {
                  bold: true
                },
                fields: 'bold'
              }
            });
          }
        }
      }
    }
        
    // バッチ更新が必要な場合は実行
    if (requests.length > 0) {
      requests = await updateBatch(requests);
    }
  }

  // テーブルの終わりはインデックスを2つ分進める必要がある（テーブルの終わりと改行）
  tableIndex += 2;

  requests.push({
    insertText: {
      text: '\n',
      location: { index: tableIndex }
    }
  });

  tableIndex += 1; // 改行の分インデックスを進める
  textLength = tableIndex - startIndex; // テーブルの長さを計算

  // テーブル全体の長さを返す
  return {
    requests,
    textLength,
    updateImmediately: false
  };
}

/**
 * Notionのアノテーションに基づいてGoogle Docsのテキストスタイルリクエストオブジェクトを作成
 */
function createTextStyleRequest(startIndex: number, endIndex: number, annotations: any): any {
  if (!annotations) return null;
  
  const fields = [];
  const textStyle: any = {};
  
  if (annotations.bold) {
    textStyle.bold = true;
    fields.push('bold');
  }
  
  if (annotations.italic) {
    textStyle.italic = true;
    fields.push('italic');
  }
  
  if (annotations.strikethrough) {
    textStyle.strikethrough = true;
    fields.push('strikethrough');
  }
  
  if (annotations.underline) {
    textStyle.underline = true;
    fields.push('underline');
  }
  
  if (annotations.code) {
    // コードスタイルの場合は等幅フォントを使用
    textStyle.weightedFontFamily = {
      fontFamily: 'Consolas',
      weight: 400
    };
    fields.push('weightedFontFamily');
    
    // 背景色を設定してコードブロックっぽく
    textStyle.backgroundColor = {
      color: {
        rgbColor: {
          red: 0.95,
          green: 0.95,
          blue: 0.95
        }
      }
    };
    fields.push('backgroundColor');
  }
  
  // 色の設定
  if (annotations.color && annotations.color !== 'default') {
    textStyle.foregroundColor = mapNotionColorToGoogleColor(annotations.color);
    fields.push('foregroundColor');
  }
  
  if (fields.length === 0) {
    return null;
  }
  
  return {
    updateTextStyle: {
      range: {
        startIndex,
        endIndex
      },
      textStyle,
      fields: fields.join(',')
    }
  };
}

/**
 * NotionのカラーコードをGoogle Docsのカラーオブジェクトに変換
 */
function mapNotionColorToGoogleColor(notionColor: string): any {
  const colorMap: {[key: string]: {r: number, g: number, b: number}} = {
    'blue': {r: 0.13, g: 0.59, b: 0.95},
    'brown': {r: 0.5, g: 0.3, b: 0.1},
    'gray': {r: 0.5, g: 0.5, b: 0.5},
    'green': {r: 0.13, g: 0.69, b: 0.42},
    'orange': {r: 0.99, g: 0.5, b: 0.15},
    'pink': {r: 0.97, g: 0.44, b: 0.84},
    'purple': {r: 0.69, g: 0.32, b: 0.87},
    'red': {r: 0.96, g: 0.26, b: 0.21},
    'yellow': {r: 0.97, g: 0.78, b: 0.29},
    'default': {r: 0, g: 0, b: 0}
  };
  
  // notionColorが"blue_background"のような形式の場合は"blue"だけを抽出
  const baseColor = notionColor.split('_')[0];
  const rgbColor = colorMap[baseColor] || colorMap.default;
  
  return {
    color: {
      rgbColor: {
        red: rgbColor.r,
        green: rgbColor.g,
        blue: rgbColor.b
      }
    }
  };
}
