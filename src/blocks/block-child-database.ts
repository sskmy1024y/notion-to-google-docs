import { BlockProcessFunction, NotionBlock, BlockProcessResult } from "../types";


/**
 * child_databaseブロックをGoogle Docsリクエストに変換する
 */
export const processChildDatabaseBlock: BlockProcessFunction = async (
  block: NotionBlock,
  startIndex: number,
  extractTextFromRichText,
  requests = [],
): Promise<BlockProcessResult> => {
  const databaseTitle = block.child_database?.title ?? null;

  let textLength = 0;

  const insertTextDatabaseTitle = databaseTitle ? `${databaseTitle} (データベースリンク)` : 'Linked Database';
  
  // 太字のテキスト形式でデータベースへのリンクを表示
  requests.push({
    insertText: {
      location: { index: startIndex },
      text: insertTextDatabaseTitle,
    },
  });

  textLength += insertTextDatabaseTitle.length;
  
  // 挿入したテキストにスタイルを適用（太字と色）
  requests.push({
    updateTextStyle: {
      textStyle: {
        bold: true,
        foregroundColor: {
          color: {
            rgbColor: {
              blue: 0.8,
              red: 0,
              green: 0.3,
            },
          },
        },
        link: {
          url: `https://www.notion.so/${block.id.replace(/-/g, '')}`
        },
      },
      range: {
        startIndex: startIndex,
        endIndex: startIndex + textLength,
      },
      fields: "bold,foregroundColor,link",
    },
  });
  
  // 改行を追加
  requests.push({
    insertText: {
      location: { index: startIndex + textLength },
      text: "\n",
    },
  });

  textLength += 1; // 改行を追加したので、テキスト長を更新
  
  // 説明テキスト（斜体）
  const description = "このデータベースのコンテンツの詳細は、Notionで確認できます。";
  requests.push({
    insertText: {
      location: { index: startIndex + textLength },
      text: description,
    },
  }, {
    updateTextStyle: {
      textStyle: {
        italic: true,
        foregroundColor: {
          color: {
            rgbColor: {
              blue: 0.5,
              red: 0.5,
              green: 0.5,
            },
          },
        },
      },
      range: {
        startIndex: startIndex + textLength,
        endIndex: startIndex + textLength + description.length,
      },
      fields: "italic,foregroundColor",
    },
  });

  textLength += description.length;
  
  // 段落終了の改行
  requests.push({
    insertText: {
      location: { index: startIndex + textLength },
      text: "\n\n",
    },
  });
  
  textLength += 2; // 改行を追加したので、テキスト長を更新
  
  return {
    requests,
    textLength,
    updateImmediately: false
  };
}
