// Notion types
export interface NotionBlock {
  id: string;
  type: string;
  [key: string]: any;
}

export interface NotionPage {
  id: string;
  title: string;
  blocks: NotionBlock[];
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
}

// Application types
export interface TransferResult {
  success: boolean;
  message: string;
  notionPageId?: string;
  googleDocId?: string;
  error?: Error;
}
