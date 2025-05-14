import { google, docs_v1 } from 'googleapis';
import {
  GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET,
  GOOGLE_REDIRECT_URI,
  GOOGLE_REFRESH_TOKEN,
  GOOGLE_DOC_ID
} from './config';
import { NotionBlock, NotionPage, GoogleDocsRequest, GoogleDocsResponse } from './types';

export class GoogleDocsService {
  private docs: docs_v1.Docs;

  constructor() {
    // Set up OAuth2 client
    const oauth2Client = new google.auth.OAuth2(
      GOOGLE_CLIENT_ID,
      GOOGLE_CLIENT_SECRET,
      GOOGLE_REDIRECT_URI
    );

    // Set credentials using refresh token
    oauth2Client.setCredentials({
      refresh_token: GOOGLE_REFRESH_TOKEN
    });

    // Create Google Docs client
    this.docs = google.docs({ version: 'v1', auth: oauth2Client });
  }

  /**
   * Write Notion page content to a Google Doc
   */
  async writeToDoc(notionPage: NotionPage, docId: string = GOOGLE_DOC_ID): Promise<GoogleDocsResponse> {
    try {
      // Clear the document first
      await this.clearDocument(docId);
      
      // Convert Notion blocks to Google Docs requests
      const requests = this.convertNotionToGoogleDocs(notionPage);
      
      // Write to Google Doc
      const response = await this.docs.documents.batchUpdate({
        documentId: docId,
        requestBody: {
          requests
        }
      });
      
      return {
        documentId: docId,
        writeControl: response.data.writeControl
          ? {
              requiredRevisionId: response.data.writeControl.requiredRevisionId ?? undefined
            }
          : undefined,
        replies: response.data.replies
      };
    } catch (error) {
      console.error('Error writing to Google Doc:', error);
      throw error;
    }
  }

  /**
   * Clear the content of a Google Doc
   */
  private async clearDocument(docId: string): Promise<void> {
    try {
      // Get the document to find its content
      const document = await this.docs.documents.get({
        documentId: docId
      });
      
      // If document has content, clear it
      if (document.data.body?.content && document.data.body.content.length > 1) {
        // The first element is usually the document header, so we start from index 1
        // and delete everything except the first element
        const endIndex = document.data.body.content[document.data.body.content.length - 1].endIndex;
        
        if (endIndex && endIndex > 1) {
          await this.docs.documents.batchUpdate({
            documentId: docId,
            requestBody: {
              requests: [
                {
                  deleteContentRange: {
                    range: {
                      startIndex: 1,
                      endIndex: endIndex - 1
                    }
                  }
                }
              ]
            }
          });
        }
      }
    } catch (error) {
      console.error('Error clearing Google Doc:', error);
      throw error;
    }
  }

  /**
   * Convert Notion blocks to Google Docs API requests
   */
  private convertNotionToGoogleDocs(notionPage: NotionPage): any[] {
    const requests: any[] = [];
    
    // Add title
    requests.push(
      {
        insertText: {
          location: {
            index: 1
          },
          text: notionPage.title + '\n\n'
        }
      },
      {
        updateParagraphStyle: {
          range: {
            startIndex: 1,
            endIndex: notionPage.title.length + 1
          },
          paragraphStyle: {
            namedStyleType: 'TITLE'
          },
          fields: 'namedStyleType'
        }
      }
    );
    
    // Process blocks
    let currentIndex = notionPage.title.length + 3; // +3 for title and two newlines
    
    for (const block of notionPage.blocks) {
      const blockRequests = this.processBlock(block, currentIndex);
      requests.push(...blockRequests.requests);
      currentIndex += blockRequests.textLength;
    }
    
    return requests;
  }

  /**
   * Process a single Notion block and convert it to Google Docs requests
   */
  private processBlock(block: NotionBlock, startIndex: number): { requests: any[], textLength: number } {
    const requests: any[] = [];
    let text = '';
    let textLength = 0;
    
    switch (block.type) {
      case 'paragraph':
        text = this.extractTextFromRichText(block.paragraph?.rich_text || []);
        if (text) {
          requests.push({
            insertText: {
              location: { index: startIndex },
              text: text + '\n'
            }
          });
          textLength = text.length + 1; // +1 for newline
        }
        break;
        
      case 'heading_1':
        text = this.extractTextFromRichText(block.heading_1?.rich_text || []);
        if (text) {
          requests.push(
            {
              insertText: {
                location: { index: startIndex },
                text: text + '\n'
              }
            },
            {
              updateParagraphStyle: {
                range: {
                  startIndex: startIndex,
                  endIndex: startIndex + text.length
                },
                paragraphStyle: {
                  namedStyleType: 'HEADING_1'
                },
                fields: 'namedStyleType'
              }
            }
          );
          textLength = text.length + 1; // +1 for newline
        }
        break;
        
      case 'heading_2':
        text = this.extractTextFromRichText(block.heading_2?.rich_text || []);
        if (text) {
          requests.push(
            {
              insertText: {
                location: { index: startIndex },
                text: text + '\n'
              }
            },
            {
              updateParagraphStyle: {
                range: {
                  startIndex: startIndex,
                  endIndex: startIndex + text.length
                },
                paragraphStyle: {
                  namedStyleType: 'HEADING_2'
                },
                fields: 'namedStyleType'
              }
            }
          );
          textLength = text.length + 1; // +1 for newline
        }
        break;
        
      case 'heading_3':
        text = this.extractTextFromRichText(block.heading_3?.rich_text || []);
        if (text) {
          requests.push(
            {
              insertText: {
                location: { index: startIndex },
                text: text + '\n'
              }
            },
            {
              updateParagraphStyle: {
                range: {
                  startIndex: startIndex,
                  endIndex: startIndex + text.length
                },
                paragraphStyle: {
                  namedStyleType: 'HEADING_3'
                },
                fields: 'namedStyleType'
              }
            }
          );
          textLength = text.length + 1; // +1 for newline
        }
        break;
        
      case 'bulleted_list_item':
        text = this.extractTextFromRichText(block.bulleted_list_item?.rich_text || []);
        if (text) {
          requests.push(
            {
              insertText: {
                location: { index: startIndex },
                text: text + '\n'
              }
            },
            {
              createParagraphBullets: {
                range: {
                  startIndex: startIndex,
                  endIndex: startIndex + text.length
                },
                bulletPreset: 'BULLET_DISC_CIRCLE_SQUARE'
              }
            }
          );
          textLength = text.length + 1; // +1 for newline
        }
        break;
        
      case 'numbered_list_item':
        text = this.extractTextFromRichText(block.numbered_list_item?.rich_text || []);
        if (text) {
          requests.push(
            {
              insertText: {
                location: { index: startIndex },
                text: text + '\n'
              }
            },
            {
              createParagraphBullets: {
                range: {
                  startIndex: startIndex,
                  endIndex: startIndex + text.length
                },
                bulletPreset: 'NUMBERED_DECIMAL'
              }
            }
          );
          textLength = text.length + 1; // +1 for newline
        }
        break;
        
      case 'to_do':
        text = this.extractTextFromRichText(block.to_do?.rich_text || []);
        if (text) {
          requests.push({
            insertText: {
              location: { index: startIndex },
              text: `☐ ${text}\n`
            }
          });
          textLength = text.length + 3; // +3 for checkbox and space and newline
        }
        break;
        
      case 'quote':
        text = this.extractTextFromRichText(block.quote?.rich_text || []);
        if (text) {
          requests.push(
            {
              insertText: {
                location: { index: startIndex },
                text: text + '\n'
              }
            },
            {
              updateParagraphStyle: {
                range: {
                  startIndex: startIndex,
                  endIndex: startIndex + text.length
                },
                paragraphStyle: {
                  indentStart: {
                    magnitude: 36,
                    unit: 'PT'
                  },
                  indentFirstLine: {
                    magnitude: 36,
                    unit: 'PT'
                  }
                },
                fields: 'indentStart,indentFirstLine'
              }
            }
          );
          textLength = text.length + 1; // +1 for newline
        }
        break;
        
      case 'code':
        text = this.extractTextFromRichText(block.code?.rich_text || []);
        if (text) {
          requests.push(
            {
              insertText: {
                location: { index: startIndex },
                text: text + '\n'
              }
            },
            {
              updateTextStyle: {
                range: {
                  startIndex: startIndex,
                  endIndex: startIndex + text.length
                },
                textStyle: {
                  fontFamily: 'Consolas'
                },
                fields: 'fontFamily'
              }
            }
          );
          textLength = text.length + 1; // +1 for newline
        }
        break;
        
      case 'divider':
        requests.push({
          insertText: {
            location: { index: startIndex },
            text: '---\n'
          }
        });
        textLength = 4; // 3 dashes + newline
        break;
        
      default:
        // For unsupported block types, add a placeholder
        requests.push({
          insertText: {
            location: { index: startIndex },
            text: `[Unsupported block type: ${block.type}]\n`
          }
        });
        textLength = `[Unsupported block type: ${block.type}]`.length + 1; // +1 for newline
    }
    
    // Process child blocks if they exist
    if (block.child_blocks && block.child_blocks.length > 0) {
      let childIndex = startIndex + textLength;
      
      for (const childBlock of block.child_blocks) {
        const childResult = this.processBlock(childBlock, childIndex);
        requests.push(...childResult.requests);
        childIndex += childResult.textLength;
        textLength += childResult.textLength;
      }
    }
    
    return { requests, textLength };
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
}
