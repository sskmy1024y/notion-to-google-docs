import { JSONFile } from 'lowdb/node';
import { Low } from 'lowdb';
import path from 'path';
import fs from 'fs';

// DBのスキーマ定義
export interface DBSchema {
  // NotionPageのキャッシュ
  notionPageCache: {
    [pageId: string]: {
      pageData: any; // NotionPageの内容
      lastEditedTime: string; // 最終更新日時
      cachedAt: string; // キャッシュした日時
    };
  };
  // 将来の拡張のための他のコレクション
  settings: {
    [key: string]: any;
  };
}

// デフォルトのDBデータ
const defaultData: DBSchema = {
  notionPageCache: {},
  settings: {}
};

// LowDBのインスタンスを作成するクラス
export class Database {
  private static instance: Database;
  private db: Low<DBSchema>;
  private dbPath: string;

  private constructor() {
    // DBファイルのパスを設定
    this.dbPath = path.join(process.cwd(), '.cache', 'db.json');
    
    // ディレクトリが存在しない場合は作成
    const dir = path.dirname(this.dbPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    
    // DBの初期化
    const adapter = new JSONFile<DBSchema>(this.dbPath);
    this.db = new Low<DBSchema>(adapter, defaultData);
  }

  // シングルトンパターンでインスタンスを取得
  public static getInstance(): Database {
    if (!Database.instance) {
      Database.instance = new Database();
    }
    return Database.instance;
  }

  // DBを読み込む
  public async load(): Promise<void> {
    await this.db.read();
    // データがない場合はデフォルト値を使用
    if (this.db.data === null) {
      this.db.data = defaultData;
      await this.db.write();
    }
  }

  // NotionPageをキャッシュに保存
  public async cacheNotionPage(pageId: string, pageData: any, lastEditedTime: string): Promise<void> {
    await this.load();
    
    this.db.data.notionPageCache[pageId] = {
      pageData,
      lastEditedTime,
      cachedAt: new Date().toISOString()
    };
    
    await this.db.write();
  }

  // キャッシュからNotionPageを取得
  public async getNotionPageFromCache(pageId: string): Promise<{
    pageData: any;
    lastEditedTime: string;
    cachedAt: string;
  } | null> {
    await this.load();
    
    return this.db.data.notionPageCache[pageId] || null;
  }

  // キャッシュからすべてのNotionPageを取得
  public async getAllNotionPagesFromCache(): Promise<{
    [pageId: string]: {
      pageData: any;
      lastEditedTime: string;
      cachedAt: string;
    };
  }> {
    await this.load();
    
    return this.db.data.notionPageCache;
  }

  // キャッシュを削除
  public async clearNotionPageCache(pageId?: string): Promise<void> {
    await this.load();
    
    if (pageId) {
      // 指定したページのキャッシュのみを削除
      delete this.db.data.notionPageCache[pageId];
    } else {
      // すべてのキャッシュを削除
      this.db.data.notionPageCache = {};
    }
    
    await this.db.write();
  }
}

// DBインスタンスをエクスポート
export const db = Database.getInstance();
