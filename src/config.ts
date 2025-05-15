import dotenv from 'dotenv';
import { resolve } from 'path';

// Load environment variables from .env file
dotenv.config({ path: resolve(process.cwd(), '.env') });

// Notion configuration
export const NOTION_API_KEY = process.env.NOTION_API_KEY || '';
export const NOTION_PAGE_ID = process.env.NOTION_PAGE_ID || '';

// Google API configuration
export const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || '';
export const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || '';
export const GOOGLE_REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI || '';
export const GOOGLE_REFRESH_TOKEN = process.env.GOOGLE_REFRESH_TOKEN || '';
export const GOOGLE_DOC_ID = process.env.GOOGLE_DOC_ID || '';

// 動的認証が必要かどうかを判断する
export const NEEDS_DYNAMIC_AUTH = !GOOGLE_REFRESH_TOKEN;

// Validate required environment variables
export function validateConfig(): void {
  // 動的認証を使用する場合は、GOOGLE_REFRESH_TOKENが不要
  const requiredVars = [
    { name: 'NOTION_API_KEY', value: NOTION_API_KEY },
    { name: 'NOTION_PAGE_ID', value: NOTION_PAGE_ID },
    { name: 'GOOGLE_CLIENT_ID', value: GOOGLE_CLIENT_ID },
    { name: 'GOOGLE_CLIENT_SECRET', value: GOOGLE_CLIENT_SECRET },
    { name: 'GOOGLE_DOC_ID', value: GOOGLE_DOC_ID },
  ];

  // リフレッシュトークンを使用する場合のみ、GOOGLE_REDIRECT_URIとGOOGLE_REFRESH_TOKENを検証
  if (!NEEDS_DYNAMIC_AUTH) {
    requiredVars.push(
      { name: 'GOOGLE_REDIRECT_URI', value: GOOGLE_REDIRECT_URI },
      { name: 'GOOGLE_REFRESH_TOKEN', value: GOOGLE_REFRESH_TOKEN }
    );
  }

  const missingVars = requiredVars.filter(({ value }) => !value);

  if (missingVars.length > 0) {
    const missingVarNames = missingVars.map(({ name }) => name).join(', ');
    throw new Error(`Missing required environment variables: ${missingVarNames}`);
  }
}
