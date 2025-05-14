import { Client } from '@notionhq/client';
import { NOTION_API_KEY, NOTION_PAGE_ID } from './config';
import { NotionBlock, NotionPage } from './types';

export class NotionService {
  private client: Client;

  constructor() {
    this.client = new Client({
      auth: NOTION_API_KEY,
    });
  }

  /**
   * Fetch a page from Notion by ID
   */
  async getPage(pageId: string = NOTION_PAGE_ID): Promise<NotionPage> {
    try {
      // Get page metadata
      const page = await this.client.pages.retrieve({ page_id: pageId });
      
      // Get page title
      const title = this.extractPageTitle(page);
      
      // Get page blocks
      const blocks = await this.getPageBlocks(pageId);
      
      return {
        id: pageId,
        title,
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
      const response = await this.client.blocks.children.list({
        block_id: pageId,
        start_cursor: cursor,
      });
      
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
          // Fetch child blocks
          const childBlocks = await this.getPageBlocks(block.id);
          
          // Add child_blocks property to the parent block
          block.child_blocks = childBlocks;
        } catch (error) {
          console.error(`Error fetching child blocks for ${block.id}:`, error);
        }
      }
    }
    
    return blocksWithChildren;
  }
}
