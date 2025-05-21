import { BlockProcessFunction, NotionBlock, BlockProcessResult, NotionPageListItem } from "../types";
import { NotionService } from "../notion";

// NotionServiceのインスタンスを作成
const notionService = new NotionService();

/**
 * データベースのページ情報をテーブル形式でGoogleドキュメントに追加する
 */
async function addDatabaseTableToDoc(
  pages: NotionPageListItem[],
  startIndex: number,
  requests: any[]
): Promise<number> {
  let textLength = 0;
  
  if (pages.length === 0) {
    return textLength;
  }
  
  // サンプルページから全propertyのキーを取得
  const samplePage = pages[0];
  if (!samplePage || !samplePage.properties) {
    // 古い形式のデータ構造の場合は以前の実装を使用
    return addLegacyDatabaseTableToDoc(pages, startIndex, requests);
  }
  
  // propertiesからヘッダーを生成
  const propertyKeys = Object.keys(samplePage.properties);
  if (propertyKeys.length === 0) {
    // propertiesが空の場合も以前の実装を使用
    return addLegacyDatabaseTableToDoc(pages, startIndex, requests);
  }
  
  // テーブルのヘッダー行
  const headers = propertyKeys;
  const headerRow = `| ${headers.join(' | ')} |\n`;
  
  // テーブルの区切り行
  const separator = `| ${headers.map(() => '---').join(' | ')} |\n`;
  
  // テーブルのデータ行
  const rows = pages.map(page => {
    const cells = propertyKeys.map(key => {
      const property = page.properties?.[key];
      let value = '';
      
      if (property) {
        // プロパティのタイプに応じて値を抽出
        switch (property.type) {
          case 'title':
            value = property.title?.map((t: any) => t.plain_text).join('') || '';
            break;
          case 'rich_text':
            value = property.rich_text?.map((t: any) => t.plain_text).join('') || '';
            break;
          case 'date':
            value = property.date?.start 
              ? new Date(property.date.start).toLocaleDateString('ja-JP')
              : '';
            break;
          case 'number':
            value = property.number?.toString() || '';
            break;
          case 'select':
            value = property.select?.name || '';
            break;
          case 'multi_select':
            value = property.multi_select?.map((s: any) => s.name).join(', ') || '';
            break;
          case 'checkbox':
            value = property.checkbox ? '✓' : '';
            break;
          case 'url':
            value = property.url || '';
            break;
          case 'email':
            value = property.email || '';
            break;
          case 'phone_number':
            value = property.phone_number || '';
            break;
          case 'created_time':
            value = property.created_time 
              ? new Date(property.created_time).toLocaleDateString('ja-JP')
              : '';
            break;
          case 'last_edited_time':
            value = property.last_edited_time 
              ? new Date(property.last_edited_time).toLocaleDateString('ja-JP')
              : '';
            break;
          default:
            value = 'N/A';
        }
      }
      
      return value;
    });
    
    return `| ${cells.join(' | ')} |`;
  }).join('\n');
  
  // テーブル全体を組み立て
  const tableText = `${headerRow}${separator}${rows}\n`;
  
  // テーブルをドキュメントに挿入
  requests.push({
    insertText: {
      location: { index: startIndex },
      text: tableText,
    },
  });
  
  textLength += tableText.length;
  
  return textLength;
}

/**
 * 従来形式のデータベースのページ情報をテーブル形式でGoogleドキュメントに追加する
 * 後方互換性のために保持
 */
async function addLegacyDatabaseTableToDoc(
  pages: NotionPageListItem[],
  startIndex: number,
  requests: any[]
): Promise<number> {
  let textLength = 0;
  
  // テーブルのヘッダー行
  const headers = ['タイトル', '最終更新日', '作成日'];
  const headerRow = `| ${headers.join(' | ')} |\n`;
  
  // テーブルの区切り行
  const separator = `| ${headers.map(() => '---').join(' | ')} |\n`;
  
  // テーブルのデータ行
  const rows = pages.map(page => {
    const lastEdited = page.lastEditedTime 
      ? new Date(page.lastEditedTime).toLocaleDateString('ja-JP')
      : 'N/A';
    
    const created = page.createdTime
      ? new Date(page.createdTime).toLocaleDateString('ja-JP')
      : 'N/A';
    
    return `| ${page.title} | ${lastEdited} | ${created} |`;
  }).join('\n');
  
  // テーブル全体を組み立て
  const tableText = `${headerRow}${separator}${rows}\n`;
  
  // テーブルをドキュメントに挿入
  requests.push({
    insertText: {
      location: { index: startIndex },
      text: tableText,
    },
  });
  
  textLength += tableText.length;
  
  return textLength;
}

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
  const databaseId = block.id.replace(/-/g, '');
  
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
  
  // データベースからページ情報を取得して表示
  try {
    // Notionデータベースの情報を取得
    const dbPages = await notionService.getDatabasePages(databaseId).catch((error) => {
      return [];
    });
    
    if (dbPages.length > 0) {
      console.log(`データベース(${databaseId})のページ情報を取得しました:`, dbPages);
      // データベースの内容をマークダウンテーブルとして表示
      const tableLength = await addDatabaseTableToDoc(dbPages, startIndex + textLength, requests);
      textLength += tableLength;
      
      // テーブルの後に改行を追加
      requests.push({
        insertText: {
          location: { index: startIndex + textLength },
          text: "\n\n",
        },
      });
      
      textLength += 2; // テーブル後の改行
    }
  } catch (error) {
    console.error(`データベース(${databaseId})の情報取得中にエラーが発生しました:`, error);
    // エラーが発生した場合はテーブルを表示せず、処理を続行
  }
  
  return {
    requests,
    textLength,
    updateImmediately: false
  };
}
