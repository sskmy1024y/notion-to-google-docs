import { google, docs_v1 } from 'googleapis';
import {
  GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET,
  GOOGLE_DOC_ID
} from './config';
import { NotionBlock, NotionPage, GoogleDocsResponse, BlockProcessResult, BlockProcessFunction } from './types';
import { getGoogleAuthCredentials } from './google-auth';
import { writeLog } from './log';
import { matchProcess } from './blocks';

/**
 * NotionページIDからNotionページのURLを生成
 */
function getNotionPageUrl(pageId: string): string {
  return `https://notion.so/${pageId.replace(/-/g, '')}`;
}

export class GoogleDocsService {
  private docs: docs_v1.Docs;

  constructor(oauth2Client?: any) {
    // 既存のoauth2Clientが提供された場合はそれを使用
    if (oauth2Client) {
      this.docs = google.docs({ version: 'v1', auth: oauth2Client });
      return;
    }

    // 提供されていない場合は、静的な認証情報を使用
    const client = new google.auth.OAuth2(
      GOOGLE_CLIENT_ID,
      GOOGLE_CLIENT_SECRET,
    );

    // Create Google Docs client
    this.docs = google.docs({ version: 'v1', auth: client });
  }

  /**
   * 動的な認証を使用してGoogleDocsServiceのインスタンスを作成
   */
  static async createWithDynamicAuth(): Promise<GoogleDocsService> {
    const { oauth2Client } = await getGoogleAuthCredentials();
    return new GoogleDocsService(oauth2Client);
  }

  /**
   * Write Notion page content to a Google Doc
   * 同じNotionページIDが既に存在する場合は更新、存在しない場合は新規追加
   */
  async writeToDoc(notionPage: NotionPage, docId: string = GOOGLE_DOC_ID): Promise<GoogleDocsResponse> {
    try {
      writeLog(`[GoogleDocs] documents.get request: ${docId}`);
      const document = await this.docs.documents.get({
        documentId: docId
      });
      writeLog(`[GoogleDocs] documents.get response: ${JSON.stringify(document.data, null, 2)}`);
      
      // Notionページが既にドキュメント内に存在するか確認
      const existingPageLocation = this.findNotionPageInDoc(document, notionPage.id);
      
      if (existingPageLocation) {
        writeLog(`[GoogleDocs] Updating existing Notion page: ${notionPage.id}`);
        console.log(`既存のNotionページID ${notionPage.id} を発見しました。更新します。`);
       
        // const adjustedEndIndex = this.adjustEndIndexForNewline(
        //   existingPageLocation.startIndex,
        //   existingPageLocation.endIndex,
        //   document
        // );

        // 既存のコンテンツを削除するリクエスト
        const deleteRequests = this.createDeleteContentRequests(
          existingPageLocation.startIndex,
          existingPageLocation.endIndex,
        );
        
        writeLog(`[GoogleDocs] batchUpdate (delete) request: ${JSON.stringify(deleteRequests, null, 2)}`);
        // 既存のコンテンツ削除
        await this.docs.documents.batchUpdate({
          documentId: docId,
          requestBody: { requests: deleteRequests }
        });

        // スタイルをリセットするリクエストを実行
        // これにより、周囲のテキストスタイルが新しいコンテンツに影響しなくなる
        const resetStyleRequests = this.createResetStyleRequest(existingPageLocation.startIndex);
        writeLog(`[GoogleDocs] batchUpdate (reset style) request: ${JSON.stringify(resetStyleRequests, null, 2)}`);
        await this.docs.documents.batchUpdate({
          documentId: docId,
          requestBody: { requests: resetStyleRequests }
        });
  
        // 同じ位置に新しいコンテンツを挿入
        await this.convertNotionToGoogleDocs(notionPage, existingPageLocation.startIndex, docId);
        
        return {
          documentId: docId,
          writeControl: undefined,
          replies: undefined,
          updated: true // 更新されたことを示すフラグを追加
        };
      }
      
      // 既存のページが見つからなかった場合は新規追加
      console.log(`Notionページ ${notionPage.id} は新規追加します。`);
      
      // ドキュメントが空でない場合は改ページを追加するためのインデックスを取得
      let startIndex = 1; // デフォルトは先頭（空のドキュメントの場合）
      
      if (document.data.body?.content && document.data.body.content.length > 1) {
        const lastContentElement = document.data.body.content[document.data.body.content.length - 1];
        if (lastContentElement.endIndex) {
          startIndex = lastContentElement.endIndex - 1;
          
          // 空のドキュメントでない場合は改ページを追加
          if (startIndex > 1) {
            writeLog(`[GoogleDocs] batchUpdate (insertPageBreak) request: index=${startIndex}`);
            await this.docs.documents.batchUpdate({
              documentId: docId,
              requestBody: {
                requests: [
                  {
                    insertPageBreak: {
                      location: {
                        index: startIndex
                      }
                    }
                  }
                ]
              }
            });
            
            // 改ページ追加後に開始位置を更新
            startIndex += 1;
            
            // 新規追加の場合もスタイルをリセット
            const resetStyleRequests = this.createResetStyleRequest(startIndex);
            writeLog(`[GoogleDocs] batchUpdate (reset style) request: ${JSON.stringify(resetStyleRequests, null, 2)}`);
            await this.docs.documents.batchUpdate({
              documentId: docId,
              requestBody: { requests: resetStyleRequests }
            });
          }
        }
      }
      
      // Convert Notion blocks to Google Docs requests
      await this.convertNotionToGoogleDocs(notionPage, startIndex, docId);
      
      return {
        documentId: docId,
        writeControl: undefined,
        replies: undefined,
        updated: false // 新規追加されたことを示すフラグを追加
      };
    } catch (error) {
      writeLog(`[ERROR][GoogleDocs] ${error instanceof Error ? error.message : String(error)}`);
      console.error('Error writing to Google Doc:', error);
      throw error;
    }
  }

  /**
   * Convert Notion blocks to Google Docs API requests
   * 各ブロックごとに個別にbatchUpdateを実行する
   */
  private async convertNotionToGoogleDocs(notionPage: NotionPage, startIndex: number, docId: string = GOOGLE_DOC_ID): Promise<void> {
    let requests: any[] = [];
    
    // Add title
    requests.push(
      {
        insertText: {
          location: {
            index: startIndex
          },
          text: notionPage.title + '\n'
        }
      },
      {
        updateParagraphStyle: {
          range: {
            startIndex: startIndex,
            endIndex: startIndex + notionPage.title.length
          },
          paragraphStyle: {
            namedStyleType: 'TITLE'
          },
          fields: 'namedStyleType'
        }
      }
    );
    
    // ページIDをタイトルの後に追加
    const pageIdText = `Notion Page ID: ${notionPage.id}`;
    const pageIdStartIndex = startIndex + notionPage.title.length + 1; // +1 for title newline
    const notionPageUrl = getNotionPageUrl(notionPage.id);
    
    requests.push(
      {
        insertText: {
          location: {
            index: pageIdStartIndex
          },
          text: pageIdText
        }
      },
      {
        updateTextStyle: {
          range: {
            startIndex: pageIdStartIndex,
            endIndex: pageIdStartIndex + pageIdText.length
          },
          textStyle: {
            fontSize: {
              magnitude: 8,
              unit: 'PT'
            },
            foregroundColor: {
              color: {
                rgbColor: {
                  red: 0.5,
                  green: 0.5,
                  blue: 0.5
                }
              }
            },
            link: {
              url: notionPageUrl
            }
          },
          fields: 'fontSize,foregroundColor,link'
        }
      },
      {
        insertText: {
          location: {
            index: pageIdStartIndex + pageIdText.length
          },
          text: '\n'
        }
      }
    );
    
    let currentIndex = pageIdStartIndex + pageIdText.length + 1; // +1 for extra newline
    
    // 追加の改行を入れる
    requests.push({
      insertText: {
        location: { 
          index: pageIdStartIndex + pageIdText.length 
        },
        text: '\n'
      }
    });
    
    // Add properties table if there are properties
    if (notionPage.properties && notionPage.properties.length > 0) {
      const propertiesRequests = this.createPropertiesTable(notionPage.properties, currentIndex);
      requests.push(...propertiesRequests.requests);
      currentIndex += propertiesRequests.textLength;
      
      // Add a newline after the table
      requests.push({
        insertText: {
          location: { index: currentIndex },
          text: '\n'
        }
      });
      currentIndex += 1;
    }

    // 各ブロックを処理し、個別に更新を行う
    for (const block of notionPage.blocks) {
      const blockResult = await this.processBlock(block, requests, currentIndex, docId);
      currentIndex += blockResult.textLength;
      requests = blockResult.requests;
    }

    // 最後に、全てのリクエストをまとめてGoogle Docsに送信
    if (requests.length > 0) {
      writeLog(`[GoogleDocs] batchUpdate (blocks) request: ${JSON.stringify(requests, null, 2)}`);
      await this.docs.documents.batchUpdate({
        documentId: docId,
        requestBody: { requests }
      });
    }
  }

  /**
   * Process a single block and immediately update Google Docs
   * 各ブロックを処理し、即時にGoogle Docsを更新する
   */
  private async processBlock(block: NotionBlock, requests: any[], startIndex: number, docId: string): Promise<BlockProcessResult> {
    const processBlockFn = await matchProcess(block);

    const updateBatch = docId ? async (requests: any[]) => {
      if (requests && requests.length > 0) {
        writeLog(`[GoogleDocs] batchUpdate (block) request: ${JSON.stringify(requests, null, 2)}`);
        await this.updateBatch(requests, docId);
      }
      return [];
    } : undefined;

    // ブロックを処理し、Google Docs APIリクエストを生成
    return await processBlockFn(block, startIndex, this.extractTextFromRichText.bind(this), requests, updateBatch, 0);
  }

  /**
   * Extract plain text from Notion rich text array
   */
  private extractTextFromRichText(richText: any[]): string {
    if (!Array.isArray(richText)) {
      return '';
    }
    
    return richText.map(text => text.plain_text || '').join('');
  }

  /**
   * Create a table for Notion page properties
   */
  private createPropertiesTable(properties: any[], startIndex: number): { requests: any[], textLength: number } {
    const requests: any[] = [];
    let textLength = 0;
    
    // Add a heading for the properties section
    const propertiesHeading = 'Page Properties';
    requests.push(
      {
        insertText: {
          location: { index: startIndex },
          text: propertiesHeading + '\n'
        }
      },
      {
        updateParagraphStyle: {
          range: {
            startIndex: startIndex,
            endIndex: startIndex + propertiesHeading.length
          },
          paragraphStyle: {
            namedStyleType: 'HEADING_2'
          },
          fields: 'namedStyleType'
        }
      }
    );
    
    textLength += propertiesHeading.length + 1; // +1 for newline
    const tableStartIndex = startIndex + textLength;
    
    // Filter out title property and prepare property data
    const filteredProperties = properties.filter(prop => prop.type !== 'title');
    
    // If we have no properties to display (only title), return empty requests
    if (filteredProperties.length === 0) {
      return { requests: [], textLength: 0 };
    }
    
    // Create a simple text representation of the properties
    let propertiesText = '';
    
    // Calculate column widths for better formatting
    const maxNameLength = Math.max(
      'Property Name'.length,
      ...filteredProperties.map(prop => prop.name.length)
    );
    const maxTypeLength = Math.max(
      'Property Type'.length,
      ...filteredProperties.map(prop => prop.type.length)
    );
    
    // Create header row with padding
    const namePadding = ' '.repeat(Math.max(0, maxNameLength - 'Property Name'.length + 2));
    const typePadding = ' '.repeat(Math.max(0, maxTypeLength - 'Property Type'.length + 2));
    propertiesText += `Property Name${namePadding}| Property Type${typePadding}| Value\n`;
    
    // Create separator row
    const nameHyphens = '-'.repeat(maxNameLength + 2);
    const typeHyphens = '-'.repeat(maxTypeLength + 2);
    const valueHyphens = '-'.repeat(10); // Arbitrary width for value column
    propertiesText += `${nameHyphens}|${typeHyphens}|${valueHyphens}\n`;
    
    // Add property rows
    for (const prop of filteredProperties) {
      // Format the value as a string
      let valueStr = '';
      if (prop.value === null || prop.value === undefined) {
        valueStr = '';
      } else if (typeof prop.value === 'boolean') {
        valueStr = prop.value ? 'Yes' : 'No';
      } else {
        valueStr = String(prop.value);
      }
      
      // Add padding for alignment
      const namePadding = ' '.repeat(Math.max(0, maxNameLength - prop.name.length + 2));
      const typePadding = ' '.repeat(Math.max(0, maxTypeLength - prop.type.length + 2));
      
      propertiesText += `${prop.name}${namePadding}| ${prop.type}${typePadding}| ${valueStr}\n`;
    }
    
    // Insert the properties as a simple text table
    requests.push({
      insertText: {
        location: { index: tableStartIndex },
        text: propertiesText
      }
    });
    
    textLength += propertiesText.length;
    
    return { requests, textLength };
  }

  /**
   * Google Docsドキュメント内で特定のNotionページIDを検索
   * @param document Google Docsドキュメント
   * @param notionPageId 検索するNotionページID
   * @returns 見つかった場合はページの開始位置と終了位置を含むオブジェクト、見つからない場合はnull
   */
  private findNotionPageInDoc(document: any, notionPageId: string): { startIndex: number, endIndex: number } | null {
    if (!document.data.body?.content) {
      return null;
    }

    const content = document.data.body.content;
    const docText = content
      .filter((item: any) => item.paragraph && item.paragraph.elements)
      .flatMap((item: any) => item.paragraph.elements)
      .filter((element: any) => element.textRun && element.textRun.content)
      .map((element: any) => element.textRun.content)
      .join('');
    
    // NotionページIDの検索パターン
    const searchPattern = `Notion Page ID: ${notionPageId}`;
    const pageIdIndex = docText.indexOf(searchPattern);
    
    if (pageIdIndex === -1) {
      return null;
    }

    // IDを見つけたら、そのページコンテンツの範囲を特定する
    let startIndex = 0;
    let endIndex = 0;
    
    // IDの位置を特定し、そこから前方に検索して2つ目の改行文字を見つける
    let idPosition = 0;
    let pageTitle = '';
    let foundIdPosition = false;
    
    // まずIDの正確な位置を特定
    for (let i = 0; i < content.length && !foundIdPosition; i++) {
      const item = content[i];
      if (item.paragraph && item.paragraph.elements) {
        for (const element of item.paragraph.elements) {
          if (element.textRun && element.textRun.content) {
            const elemText = element.textRun.content;
            if (elemText.includes(searchPattern)) {
              idPosition = item.startIndex || 0;
              // IDの位置を見つけたら、そこから改行分をスキップ
              startIndex = Math.max(idPosition - pageTitle.length, 0);
              foundIdPosition = true;
              break;
            } else {
              pageTitle = elemText;
            }
          }
        }
      }
    }
    
    if (!foundIdPosition) {
      return null;
    }
    
    // このページIDの次のページIDまたはドキュメントの終わりまでを探す
    // 次のページIDまたは改ページがこのページIDの終了を意味する
    const nextPageIdIndex = docText.indexOf('Notion Page ID:', pageIdIndex + searchPattern.length);
    const nextPageBreak = docText.indexOf('\n\n\n', pageIdIndex + searchPattern.length);
    
    if (nextPageIdIndex !== -1 && (nextPageBreak === -1 || nextPageIdIndex < nextPageBreak)) {
      // 次のページIDがある場合、そのページのタイトルの開始位置を取得
      
      // タイトル検出のため、このページIDから次のページIDの間のテキストを探索
      let titleStartIndex = -1;
      let currentPos = 0;
      
      for (const item of content) {
        if (item.paragraph && item.paragraph.elements) {
          for (const element of item.paragraph.elements) {
            if (element.textRun && element.textRun.content) {
              const elemText = element.textRun.content;
              const elemPos = docText.indexOf(elemText, currentPos);
              currentPos = elemPos + elemText.length;
              
              // 次のNotionページIDを含む要素の位置を特定
              if (elemText.includes('Notion Page ID:') && 
                  elemPos > pageIdIndex && 
                  elemPos <= nextPageIdIndex + 15) { // 「Notion Page ID:」の長さを考慮
                
                // この要素の直前の要素（＝タイトル）を探す
                let foundNextPageTitle = false;
                
                // contentを再度走査して前のタイトル要素を見つける
                for (const titleItem of content) {
                  if (titleItem.paragraph && 
                      titleItem.endIndex && 
                      titleItem.endIndex <= item.startIndex && 
                      (!foundNextPageTitle || titleItem.endIndex > titleStartIndex)) {
                    
                    // タイトルの可能性がある要素を見つけた
                    // タイトルは通常ページID行の直前にある
                    titleStartIndex = titleItem.startIndex;
                    foundNextPageTitle = true;
                  }
                }
                
                if (foundNextPageTitle) {
                  endIndex = titleStartIndex;
                  return { startIndex, endIndex };
                }
                
                // タイトルが見つからない場合はIDの行の先頭を使用
                endIndex = item.startIndex;
                return { startIndex, endIndex };
              }
            }
          }
        }
      }
    }
    
    // 次のページIDが見つからない場合はドキュメントの最後まで
    function getLastNonNewlineEndIndex(contents: any[], idx: number): number {
      if (idx < 0) return 0;
      
      const item = contents[idx];
      if (
        item.paragraph &&
        item.paragraph.elements
      ) {
        if (
          item.paragraph.elements.length > 0 &&
          item.paragraph.elements.every(
            (el: any) => (el.textRun?.content ?? '').trim() === '' || el.textRun?.content === '\n'
          )
        ) {
          // 改行のみの場合は一つ前を再帰的に探す
          return getLastNonNewlineEndIndex(contents, idx - 1);
        } else if (
          item.paragraph.elements[item.paragraph.elements.length - 1].textRun?.content.endsWith('\n')
        ) {
          // 改行がある場合は一つ前の位置を返す
          return item.endIndex - 1;
        }
      }

      // それ以外の場合はそのままendIndexを返す
      return item.endIndex || 0;
    }

    if (content.length > 0) {
      endIndex = getLastNonNewlineEndIndex(content, content.length - 1);
    }
    
    return { startIndex, endIndex };
  }

  /**
   * 既存のページコンテンツを削除するリクエストを生成
   * Google DocsのAPIでは段落の最後の改行文字を削除範囲に含められないため、適切に調整する
   */
  private createDeleteContentRequests(startIndex: number, endIndex: number): any[] {  
    return [
      {
        deleteParagraphBullets: {
          range: {
            startIndex: startIndex,
            endIndex: endIndex,
          },
        }
      },
      {
        deleteContentRange: {
          range: {
            startIndex: startIndex,
            endIndex: endIndex
          }
        }
      },
      {
        insertText: {
          location: {
            index: startIndex
          },
          text: '\n'
        }
      }
    ];
  }

  /**
   * スタイルをリセットするリクエストを生成
   * これにより新しいコンテンツが以前のスタイルの影響を受けなくなる
   */
  private createResetStyleRequest(index: number): any[] {
    return [
      {
        updateParagraphStyle: {
          range: {
            startIndex: index,
            endIndex: index + 1
          },
          paragraphStyle: {
            namedStyleType: 'NORMAL_TEXT'
          },
          fields: '*'
        }
      }
    ];
  }

  /**
   * Update a Google Docs document with the given requests
   * @param requests Google Docs API requests
   * @param docId Google Docs document ID
   * @returns Empty requests array to continue with
   */
  async updateBatch(requests: any[], docId: string): Promise<any[]> {
    if (requests && requests.length > 0) {
      writeLog(`[GoogleDocs] batchUpdate request: ${JSON.stringify(requests, null, 2)}`);
      const response = await this.docs.documents.batchUpdate({
        documentId: docId,
        requestBody: { requests }
      });
      writeLog(`[GoogleDocs] batchUpdate response: ${JSON.stringify(response.data, null, 2)}`);
    }
    // リクエスト実行後は空の配列を返す
    return [];
  }
}
