// Notion types
export interface NotionBlock {
  id: string;
  type: string;
  [key: string]: any;
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
}

// Application types
export interface TransferResult {
  success: boolean;
  message: string;
  notionPageId?: string;
  googleDocId?: string;
  error?: Error;
}
