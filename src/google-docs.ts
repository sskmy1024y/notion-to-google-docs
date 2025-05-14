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
          // Make sure the range is not empty
          const startIndex = 1;
          const safeEndIndex = endIndex - 1;
          
          if (safeEndIndex > startIndex) {
            await this.docs.documents.batchUpdate({
              documentId: docId,
              requestBody: {
                requests: [
                  {
                    deleteContentRange: {
                      range: {
                        startIndex: startIndex,
                        endIndex: safeEndIndex
                      }
                    }
                  }
                ]
              }
            });
          }
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
    
    let currentIndex = notionPage.title.length + 3; // +3 for title and two newlines
    
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
    
    // Process blocks
    
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
}
