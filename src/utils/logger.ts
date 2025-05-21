import fs from 'fs';
import path from 'path';

// ログファイルパス
const LOG_FILE = path.join(process.cwd(), 'debug.log');

// ログ書き込み関数
export function writeLog(message: string) {
  const timestamp = new Date().toISOString();
  fs.appendFileSync(LOG_FILE, `[${timestamp}] ${message}\n`);
}

// オリジナルのコンソール関数を保存
const origLog = console.log;
const origError = console.error;

// コンソール関数をオーバーライド
export function setupLogging() {
  console.log = (...args: any[]) => {
    origLog(...args);
    writeLog(args.map(a => (typeof a === 'string' ? a : JSON.stringify(a, null, 2))).join(' '));
  };

  console.error = (...args: any[]) => {
    origError(...args);
    writeLog('[ERROR] ' + args.map(a => (typeof a === 'string' ? a : JSON.stringify(a, null, 2))).join(' '));
  };
}

// ロギングをリセット（テスト用などに）
export function resetLogging() {
  console.log = origLog;
  console.error = origError;
}
