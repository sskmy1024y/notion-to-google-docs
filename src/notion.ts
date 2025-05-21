import { Client, GetDatabaseResponse } from '@notionhq/client';
import { NOTION_API_KEY, NOTION_DATABASE_ID } from './config';
import { NotionBlock, NotionPage, NotionPageListItem, NotionTableBlock } from './types';
import fs from 'fs';
import path from 'path';
import { db } from './database';

const LOG_FILE = path.join(process.cwd(), 'debug.log');
function writeLog(message: string) {
  const timestamp = new Date().toISOString();
  fs.appendFileSync(LOG_FILE, `[${timestamp}] ${message}\n`);
}

export class NotionService {
  private client: Client;
  private useCache: boolean;

  constructor(useCache: boolean = true) {
    this.client = new Client({
      auth: NOTION_API_KEY,
    });
    this.useCache = useCache;
  }

  /**
   * データベースからページのリストを取得
   */
  async getDatabasePages(databaseId: string): Promise<NotionPageListItem[]> {
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
          properties: page.properties || {}
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
   * Fetch a database from Notion by ID
   */
  async getDatabase(databaseId: string): Promise<GetDatabaseResponse> {
    try {
      writeLog(`[Notion] getDatabase request: ${databaseId}`);
      const response = await this.client.databases.retrieve({
        database_id: databaseId,
      });
      writeLog(`[Notion] getDatabase response: ${JSON.stringify(response, null, 2)}`);

      return response;
    } catch (error) {
      console.error('Error fetching database:', error);
      throw error;
    }
  }

  /**
   * Fetch a page from Notion by ID
   */
  async getPage(pageId: string): Promise<NotionPage> {
    try {
      writeLog(`[Notion] getPage request: ${pageId}`);
      
      // Always fetch the latest page metadata to check last_edited_time
      const pageMetadata = await this.client.pages.retrieve({ page_id: pageId });
      const lastEditedTime = (pageMetadata as any)['last_edited_time'] as string;
      writeLog(`[Notion] getPage metadata fetched for: ${pageId}`);
      
      // Check cache if enabled
      if (this.useCache) {
        const cachedData = await db.getNotionPageFromCache(pageId);
        
        if (cachedData && cachedData.lastEditedTime === lastEditedTime) {
          console.log(`[Notion] Using cached page data: ${pageId}`);
          return cachedData.pageData;
        }
        
        console.log(`[Notion] Cache miss or outdated, fetching page: ${pageId}`);
      }
      
      // Fetch full page data
      const notionPage = await this.buildNotionPage(pageId, pageMetadata);
      
      // Cache the result if caching is enabled
      if (this.useCache) {
        await db.cacheNotionPage(pageId, notionPage, lastEditedTime);
      }
      
      return notionPage;
    } catch (error) {
      console.error('Error fetching Notion page:', error);
      throw error;
    }
  }
  
  /**
   * Build a complete NotionPage from metadata and blocks
   */
  private async buildNotionPage(pageId: string, pageMetadata: any): Promise<NotionPage> {
    const title = this.extractPageTitle(pageMetadata);
    const properties = this.extractPageProperties(pageMetadata);
    const blocks = await this.getPageBlocks(pageId);
    
    writeLog(`[Notion] Page blocks fetched for: ${pageId}`);
    
    return {
      id: pageId,
      title,
      properties,
      blocks,
    };
  }

  /**
   * キャッシュをクリア
   */
  async clearCache(pageId?: string): Promise<void> {
    await db.clearNotionPageCache(pageId);
    console.log(pageId 
      ? `[Notion] ページID ${pageId} のキャッシュをクリアしました`
      : '[Notion] すべてのページキャッシュをクリアしました'
    );
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
