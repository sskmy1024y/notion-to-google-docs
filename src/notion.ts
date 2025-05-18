import { Client } from '@notionhq/client';
import { NOTION_API_KEY, NOTION_DATABASE_ID } from './config';
import { NotionBlock, NotionPage, NotionPageListItem, NotionTableBlock } from './types';
import fs from 'fs';
import path from 'path';

const LOG_FILE = path.join(process.cwd(), 'debug.log');
function writeLog(message: string) {
  const timestamp = new Date().toISOString();
  fs.appendFileSync(LOG_FILE, `[${timestamp}] ${message}\n`);
}

export class NotionService {
  private client: Client;

  constructor() {
    this.client = new Client({
      auth: NOTION_API_KEY,
    });
  }

  /**
   * データベースからページのリストを取得
   */
  async getDatabasePages(databaseId: string = NOTION_DATABASE_ID): Promise<NotionPageListItem[]> {
    try {
      writeLog(`[Notion] getDatabasePages request: ${databaseId}`);
      // データベースのページを取得
      // Notionの内部APIではlast_edited_timeの直接指定が動作しないため、ソートを指定しない
      const response = await this.client.databases.query({
        database_id: databaseId,
      });
      writeLog(`[Notion] getDatabasePages response: ${JSON.stringify(response, null, 2)}`);

      // ページの基本情報を抽出
      const pages = response.results.map((page: any) => {
        // タイトルを取得（データベースの主キーになっているプロパティを探す）
        const title = this.extractPageTitle(page);
        
        return {
          id: page.id,
          title,
          lastEditedTime: page.last_edited_time,
          createdTime: page.created_time,
          url: page.url,
        };
      });

      // JavaScriptレベルでページを最終更新日時でソート
      pages.sort((a, b) => {
        if (!a.lastEditedTime || !b.lastEditedTime) return 0;
        return new Date(b.lastEditedTime).getTime() - new Date(a.lastEditedTime).getTime();
      });

      return pages;
    } catch (error) {
      console.error('Error fetching database pages:', error);
      throw error;
    }
  }

  /**
   * Fetch a page from Notion by ID
   */
  async getPage(pageId: string): Promise<NotionPage> {
    try {
      writeLog(`[Notion] getPage request: ${pageId}`);
      // Get page metadata
      const page = await this.client.pages.retrieve({ page_id: pageId });
      writeLog(`[Notion] getPage response: ${JSON.stringify(page, null, 2)}`);
      
      // Get page title
      const title = this.extractPageTitle(page);
      
      // Extract page properties
      const properties = this.extractPageProperties(page);
      
      // Get page blocks
      const blocks = await this.getPageBlocks(pageId);

      writeLog(`[Notion] getPage blocks: ${JSON.stringify(blocks, null, 2)}`);
      
      return {
        id: pageId,
        title,
        properties,
        blocks,
      };
    } catch (error) {
      console.error('Error fetching Notion page:', error);
      throw error;
    }
  }

  /**
   * Extract the title from a Notion page
   */
  private extractPageTitle(page: any): string {
    // Try to find the first property of type 'title'
    const properties = page.properties || {};
    for (const key in properties) {
      const prop = properties[key];
      if (prop?.type === 'title' && Array.isArray(prop.title)) {
        return prop.title.map((t: any) => t.plain_text).join('');
      }
    }
    // Fallback to page.id if no title found
    return `Notion Page (${page.id})`;
  }

  /**
   * Get all blocks from a Notion page
   */
  private async getPageBlocks(pageId: string): Promise<NotionBlock[]> {
    const blocks: NotionBlock[] = [];
    let cursor: string | undefined;
    
    // Notion API paginates blocks, so we need to fetch them in batches
    do {
      writeLog(`[Notion] getPageBlocks request: ${pageId}, cursor: ${cursor}`);
      const response = await this.client.blocks.children.list({
        block_id: pageId,
        start_cursor: cursor,
      });
      writeLog(`[Notion] getPageBlocks response: ${JSON.stringify(response, null, 2)}`);
      
      blocks.push(...response.results as NotionBlock[]);
      cursor = response.next_cursor || undefined;
    } while (cursor);
    
    // Recursively fetch child blocks for nested content
    const blocksWithChildren = await this.fetchChildBlocks(blocks);
    
    return blocksWithChildren;
  }

  /**
   * Recursively fetch child blocks for blocks that can contain children
   */
  private async fetchChildBlocks(blocks: NotionBlock[]): Promise<NotionBlock[]> {
    const blocksWithChildren: NotionBlock[] = [];
    
    for (const block of blocks) {
      // Add the current block
      blocksWithChildren.push(block);
      
      // Check if the block has children
      if (block.has_children) {
        try {
          writeLog(`[Notion] fetchChildBlocks request: ${block.id}`);
          // Fetch child blocks
          const childBlocks = await this.getPageBlocks(block.id);
          writeLog(`[Notion] fetchChildBlocks response: ${JSON.stringify(childBlocks, null, 2)}`);
          
          // Add child_blocks property to the parent block
          block.child_blocks = childBlocks;
        } catch (error) {
          console.error(`Error fetching child blocks for ${block.id}:`, error);
        }
      }
    }
    
    return blocksWithChildren;
  }

  /**
   * Extract properties from a Notion page
   */
  private extractPageProperties(page: any): any[] {
    const properties = page.properties || {};
    const result = [];
    
    for (const key in properties) {
      const prop = properties[key];
      if (!prop || !prop.type) continue;
      
      const propertyData = {
        id: prop.id,
        name: key,
        type: prop.type,
        value: this.extractPropertyValue(prop)
      };
      
      result.push(propertyData);
    }
    
    return result;
  }

  /**
   * Extract the value from a Notion property based on its type
   */
  private extractPropertyValue(property: any): any {
    const { type } = property;
    
    switch (type) {
      case 'title':
        return property.title?.map((t: any) => t.plain_text).join('') || '';
        
      case 'rich_text':
        return property.rich_text?.map((t: any) => t.plain_text).join('') || '';
        
      case 'number':
        return property.number;
        
      case 'select':
        return property.select?.name || '';
        
      case 'multi_select':
        return property.multi_select?.map((s: any) => s.name).join(', ') || '';
        
      case 'date':
        return property.date?.start || '';
        
      case 'people':
        return property.people?.map((p: any) => p.name || p.id).join(', ') || '';
        
      case 'files':
        return property.files?.map((f: any) => f.name || f.external?.url || '').join(', ') || '';
        
      case 'checkbox':
        return property.checkbox;
        
      case 'url':
        return property.url || '';
        
      case 'email':
        return property.email || '';
        
      case 'phone_number':
        return property.phone_number || '';
        
      case 'formula':
        return this.extractFormulaValue(property.formula);
        
      case 'relation':
        return property.relation?.map((r: any) => r.id).join(', ') || '';
        
      case 'rollup':
        return this.extractRollupValue(property.rollup);
        
      case 'created_time':
        return property.created_time || '';
        
      case 'created_by':
        return property.created_by?.name || property.created_by?.id || '';
        
      case 'last_edited_time':
        return property.last_edited_time || '';
        
      case 'last_edited_by':
        return property.last_edited_by?.name || property.last_edited_by?.id || '';
        
      default:
        return JSON.stringify(property);
    }
  }

  /**
   * Extract value from a formula property
   */
  private extractFormulaValue(formula: any): any {
    if (!formula) return '';
    
    const { type } = formula;
    switch (type) {
      case 'string':
        return formula.string || '';
      case 'number':
        return formula.number;
      case 'boolean':
        return formula.boolean;
      case 'date':
        return formula.date?.start || '';
      default:
        return '';
    }
  }

  /**
   * Extract value from a rollup property
   */
  private extractRollupValue(rollup: any): any {
    if (!rollup) return '';
    
    const { type } = rollup;
    switch (type) {
      case 'number':
        return rollup.number;
      case 'date':
        return rollup.date?.start || '';
      case 'array':
        return rollup.array?.map((item: any) => JSON.stringify(item)).join(', ') || '';
      default:
        return '';
    }
  }
}
