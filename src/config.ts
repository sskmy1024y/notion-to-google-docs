import dotenv from 'dotenv';
import { resolve } from 'path';

// Load environment variables from .env file
dotenv.config({ path: resolve(process.cwd(), '.env') });

// Notion configuration
export const NOTION_API_KEY = process.env.NOTION_API_KEY || '';
export const NOTION_DATABASE_ID = process.env.NOTION_DATABASE_ID || '';

// Google API configuration
export const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || '';
export const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || '';
export const GOOGLE_DOC_ID = process.env.GOOGLE_DOC_ID || '';

// Validate required environment variables
export function validateConfig(): void {
  // 動的認証を使用する場合は、GOOGLE_REFRESH_TOKENが不要
  const requiredVars = [
    { name: 'NOTION_API_KEY', value: NOTION_API_KEY },
    { name: 'GOOGLE_CLIENT_ID', value: GOOGLE_CLIENT_ID },
    { name: 'GOOGLE_CLIENT_SECRET', value: GOOGLE_CLIENT_SECRET },
    { name: 'GOOGLE_DOC_ID', value: GOOGLE_DOC_ID },
  ];

  // データベースモードかページモードどちらか一方が必要
  if (!NOTION_DATABASE_ID) {
    throw new Error('Either NOTION_DATABASE_ID or NOTION_PAGE_ID must be provided');
  }

  const missingVars = requiredVars.filter(({ value }) => !value);

  if (missingVars.length > 0) {
    const missingVarNames = missingVars.map(({ name }) => name).join(', ');
    throw new Error(`Missing required environment variables: ${missingVarNames}`);
  }
}
