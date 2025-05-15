import { select, checkbox } from '@inquirer/prompts';
import { NotionPageListItem } from './types';
import { formatDate } from './utils';

/**
 * NotionページをCLIで選択するためのプロンプトを表示
 */
export async function selectNotionPage(pages: NotionPageListItem[]): Promise<string> {
  // 選択肢の作成
  const choices = pages.map(page => {
    const lastEdited = page.lastEditedTime 
      ? `(最終更新: ${formatDate(new Date(page.lastEditedTime))})` 
      : '';
    
    return {
      name: `${page.title} ${lastEdited}`,
      value: page.id,
      description: `ID: ${page.id.slice(0, 8)}...`,
    };
  });

  // データベースにページが存在しない場合
  if (choices.length === 0) {
    throw new Error('データベースにページが見つかりませんでした。');
  }

  // プロンプトを表示してページを選択
  const selectedPageId = await select({
    message: '転記するNotionページを選択してください:',
    choices,
  });

  return selectedPageId;
}

/**
 * Notionページを複数選択するためのプロンプトを表示
 */
export async function selectMultipleNotionPages(pages: NotionPageListItem[]): Promise<string[]> {
  // 選択肢の作成
  const choices = pages.map(page => {
    const lastEdited = page.lastEditedTime 
      ? `(最終更新: ${formatDate(new Date(page.lastEditedTime))})` 
      : '';
    
    return {
      name: `${page.title} ${lastEdited}`,
      value: page.id,
      description: `ID: ${page.id.slice(0, 8)}...`,
    };
  });

  // データベースにページが存在しない場合
  if (choices.length === 0) {
    throw new Error('データベースにページが見つかりませんでした。');
  }

  // プロンプトを表示して複数ページを選択
  const selectedPageIds = await checkbox({
    message: '転記するNotionページを選択してください（複数選択可能）:',
    choices,
  });

  // 何も選択されなかった場合
  if (selectedPageIds.length === 0) {
    throw new Error('ページが選択されていません。少なくとも1つのページを選択してください。');
  }

  return selectedPageIds;
}
