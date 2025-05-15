import { createServer, IncomingMessage, ServerResponse } from 'http';
import { google, GoogleApis } from 'googleapis';
import open from 'open';
import { URL } from 'url';
import { GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET } from './config';
import { promises as fs } from 'fs';
import path from 'path';

// 認証用のローカルサーバーのポート
const PORT = 3000;
// リダイレクトURI
const REDIRECT_URI = `http://localhost:${PORT}/oauth2callback`;
// 必要なスコープ
const SCOPES = ['https://www.googleapis.com/auth/documents'];
// 認証情報を保存するJSONファイルのパス
const CREDENTIALS_PATH = path.join(process.cwd(), 'google-credentials.json');

/**
 * Google OAuthクライアントを作成
 */
export const createOAuth2Client = (): any => {
  return new google.auth.OAuth2(
    GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET,
    REDIRECT_URI
  );
}

/**
 * 認証情報をJSONファイルに保存する
 */
async function saveCredentials(tokens: any): Promise<void> {
  try {
    await fs.writeFile(CREDENTIALS_PATH, JSON.stringify(tokens, null, 2));
    console.log(`認証情報が保存されました: ${CREDENTIALS_PATH}`);
  } catch (error) {
    console.error('認証情報の保存に失敗しました:', error);
    throw error;
  }
}

/**
 * 保存された認証情報を読み込む
 */
async function loadCredentials(): Promise<any | null> {
  try {
    const data = await fs.readFile(CREDENTIALS_PATH, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    // ファイルが存在しない場合など
    console.log('保存された認証情報はありません。新しく認証を行います。');
    return null;
  }
}

/**
 * 認証に成功した際にユーザーに表示するHTML
 */
const successHtml = `
<!DOCTYPE html>
<html>
  <head>
    <title>認証成功</title>
    <style>
      body { font-family: Arial, sans-serif; text-align: center; padding: 50px; }
      h1 { color: #4CAF50; }
      p { margin-top: 20px; }
    </style>
  </head>
  <body>
    <h1>認証に成功しました！</h1>
    <p>このウィンドウを閉じて、コマンドラインに戻ってください。</p>
  </body>
</html>
`;

/**
 * 認証コードを受け取るためのローカルサーバーを作成する
 */
function startLocalServer(): Promise<string> {
  return new Promise((resolve, reject) => {
    // HTTPサーバーを作成
    const server = createServer(async (req: IncomingMessage, res: ServerResponse) => {
      try {
        // リクエストのURLとパスをパース
        const reqUrl = new URL(req.url || '', `http://localhost:${PORT}`);
        const pathname = reqUrl.pathname;

        // OAuth2コールバックパスへのリクエストを処理
        if (pathname === '/oauth2callback') {
          // クエリパラメータからコードを取得
          const code = reqUrl.searchParams.get('code');
          
          if (!code) {
            res.writeHead(400, { 'Content-Type': 'text/plain' });
            res.end('認証コードがありません');
            reject(new Error('認証コードがありません'));
            return;
          }

          // 成功ページを返す
          res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
          res.end(successHtml);
          
          // サーバーを閉じる（少し遅延させる）
          setTimeout(() => {
            server.close();
          }, 1000);
          
          // 認証コードを返す
          resolve(code);
        } else {
          // 他のパスへのリクエストは404を返す
          res.writeHead(404, { 'Content-Type': 'text/plain' });
          res.end('Not Found');
        }
      } catch (error) {
        console.error('サーバーエラー:', error);
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        res.end('Internal Server Error');
        reject(error);
      }
    });

    // サーバーエラーハンドラ
    server.on('error', (error) => {
      console.error('サーバーエラー:', error);
      reject(error);
    });

    // サーバー起動
    server.listen(PORT, () => {
      console.log(`ローカルサーバーが起動しました: http://localhost:${PORT}`);
    });
  });
}

/**
 * Google認証フローを実行し、認証情報を取得する
 */
export async function getGoogleAuthCredentials() {
  // OAuth2クライアントを作成
  const oauth2Client = createOAuth2Client();

  // 保存された認証情報を読み込む
  const savedTokens = await loadCredentials();
  
  if (savedTokens && savedTokens.refresh_token) {
    console.log('保存された認証情報を使用します。');
    oauth2Client.setCredentials(savedTokens);
    
    return {
      oauth2Client,
      tokens: savedTokens
    };
  }
  
  // 保存された有効な認証情報がない場合は、新しく認証を行う
  // 認証URLを生成
  const authorizeUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
    prompt: 'consent', // 常に同意画面を表示し、refresh_tokenを確実に取得する
  });

  console.log('以下のURLをブラウザで開いて認証を行ってください:');
  console.log(authorizeUrl);
  
  // ブラウザで認証URLを開く
  await open(authorizeUrl);
  console.log('ブラウザで認証ページを開きました。認証を完了してください...');

  // ローカルサーバーを起動して認証コードを待つ
  const code = await startLocalServer();
  console.log('認証コードを受け取りました。トークンを取得しています...');

  // 認証コードをトークンに交換
  const { tokens } = await oauth2Client.getToken(code);
  console.log('トークンの取得に成功しました。');

  // 認証情報をセット
  oauth2Client.setCredentials(tokens);
  
  // 認証情報をファイルに保存
  await saveCredentials(tokens);

  return {
    oauth2Client,
    tokens
  };
}
