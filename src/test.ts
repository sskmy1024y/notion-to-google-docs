import dotenv from 'dotenv';
import { resolve } from 'path';

// Load environment variables from .env file
dotenv.config({ path: resolve(process.cwd(), '.env') });

console.log('Test script running...');
console.log('Environment variables:');
console.log('NOTION_API_KEY:', process.env.NOTION_API_KEY ? 'Set' : 'Not set');
console.log('NOTION_PAGE_ID:', process.env.NOTION_PAGE_ID);
console.log('GOOGLE_DOC_ID:', process.env.GOOGLE_DOC_ID);
