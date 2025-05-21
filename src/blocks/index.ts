import { BlockProcessFunction, NotionBlock } from "../types";
import { processChildDatabaseBlock } from "./block-child-database";
import { processCodeBlock } from "./block-code";
import { processDividerBlock } from "./block-divider";
import { processHeadingBlock } from "./block-heading";
import { processListBlock } from "./block-list";
import { processParagraphBlock } from "./block-paragraph";
import { processQuoteBlock } from "./block-quote";
import { processSyncedBlock } from "./block-synced";
import { processTableBlock } from "./block-table";
import { processToggleBlock } from "./block-toggle";
import { processUnsupportedBlock } from "./block-unsupported";

  /**
   * Process a single Notion block and convert it to Google Docs requests
   */
  export const matchProcess = (block: NotionBlock): BlockProcessFunction => {
    // ブロックのタイプに応じて処理を分岐
    // 各ブロックタイプに対して、適切な処理関数を呼び出す
    switch (block.type) {
      case 'paragraph':
        return processParagraphBlock;
      case 'heading_1':
      case 'heading_2':
      case 'heading_3':
        return processHeadingBlock;
      case 'bulleted_list_item':
      case 'numbered_list_item':
      case 'to_do':
        return processListBlock;
      case 'quote':
        return processQuoteBlock;
      case 'code':
        return processCodeBlock;
      case 'divider':
        return processDividerBlock;
      case 'table':
        return processTableBlock;
      case 'toggle':
        return processToggleBlock;
      case 'child_database':
        return processChildDatabaseBlock;
      case 'synced_block':
        return processSyncedBlock;
      default:
        return processUnsupportedBlock;
    }
  }
