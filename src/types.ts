// Notion types
export interface NotionBlock {
  id: string;
  type: string;
  [key: string]: any;
}

// テーブルブロックの型定義
export interface NotionTableRow {
  cells: string[][];
}

export interface NotionTableBlock extends NotionBlock {
  type: 'table';
  table: {
    table_width: number;
    has_column_header: boolean;
    has_row_header: boolean;
    rows: NotionTableRow[];
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
