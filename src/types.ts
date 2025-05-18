import { docs_v1 } from "googleapis";

export type Nullish<T> = T | null | undefined;

export type Nullable<T> = T | null;

// Notion types
export interface NotionBlock {
  id: string;
  type: string;
  child_blocks?: NotionBlock[];
  has_children?: boolean;
  in_trash?: boolean;
  archived?: boolean;
  created_time?: string;
  last_edited_time?: string;
  [key: string]: any;
}

export interface NotionText {
  type: 'text';
  text: {
    content: string;
    link?: Nullable<{
      url: string;
    }>;
    annotations?: {
      bold?: boolean;
      italic?: boolean;
      strikethrough?: boolean;
      underline?: boolean;
      code?: boolean;
      color?: string;
    };
    plain_text: string;
    href?: Nullable<string>
  };
}

export interface NotionTableBlock extends NotionBlock {
  type: 'table';
  table: {
    table_width: number;
    has_column_header: boolean;
    has_row_header: boolean;
  };
}

export interface NotionTableRowBlock extends NotionBlock {
  type: 'table_row';
  table_row: {
    cells: NotionText[][];
  };
}

export interface NotionPageProperty {
  id: string;
  name: string;
  type: string;
  value: any;
}

export interface NotionPage {
  id: string;
  title: string;
  properties: NotionPageProperty[];
  blocks: NotionBlock[];
}

export interface NotionPageListItem {
  id: string;
  title: string;
  lastEditedTime?: string;
  createdTime?: string;
  url?: string;
}

// Google Docs types
export interface GoogleDocsRequest {
  documentId: string;
  requests: any[];
}

export interface GoogleDocsResponse {
  documentId: string;
  writeControl?: {
    requiredRevisionId?: string;
  };
  replies?: any[];
  updated?: boolean; // ページが更新されたかどうかを示すフラグ
}

// ブロック処理関数の戻り値の型
export interface BlockProcessResult {
  requests: any[];
  textLength: number;
  /**
   * @deprecated
   */
  updateImmediately?: boolean;
}

export type MaybePromise<T> = T | Promise<T>;

export type BlockProcessFunction = (
  block: NotionBlock,
  startIndex: number,
  extractTextFromRichText: (richText: any[]) => string,
  requests?: any[],
  updateBatch?: (reqs: any[]) => Promise<any[]>,
  depth?: number
) => MaybePromise<BlockProcessResult>;

// Application types
export interface TransferResult {
  success: boolean;
  message: string;
  notionPageId?: string;
  googleDocId?: string;
  error?: Error;
}

export interface MultiTransferResult {
  success: boolean;
  message: string;
  results: TransferResult[];
  failedCount: number;
  successCount: number;
}
