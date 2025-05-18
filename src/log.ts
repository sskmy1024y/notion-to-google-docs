import fs from 'fs';
import path from 'path';

const LOG_FILE = path.join(process.cwd(), 'debug.log');

export const writeLog = (message: string) => {
  const timestamp = new Date().toISOString();
  fs.appendFileSync(LOG_FILE, `[${timestamp}] ${message}\n`);
}
