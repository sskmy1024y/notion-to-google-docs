/**
 * 日付をフォーマットする
 * @param date 日付オブジェクト
 * @returns フォーマットされた日付文字列
 */
export function formatDate(date: Date): string {
  // 日本語のロケールで日付をフォーマット
  return date.toLocaleString('ja-JP', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * 文字列を省略する
 * @param str 対象の文字列
 * @param maxLength 最大長
 * @returns 省略された文字列
 */
export function truncate(str: string, maxLength: number = 50): string {
  if (!str) return '';
  return str.length > maxLength ? str.substring(0, maxLength) + '...' : str;
}
