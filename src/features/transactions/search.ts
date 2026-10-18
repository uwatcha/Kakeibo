import { parseYen } from '@/lib/money';

/**
 * 記録の検索条件（PostgREST の or フィルタ）を組み立てる。
 * 内容（payee）・メモの部分一致、名前が一致したカテゴリ、数字なら金額の完全一致。検索語がなければ null。
 */
export function buildSearchFilter(query: string, matchedCategoryIds: readonly string[]): string | null {
  // or フィルタの区切りや引用に使われる文字は外す
  const term = query.replace(/[,()"'\\*%]/g, ' ').trim();
  if (term === '') return null;
  const conditions = [`payee.ilike.*${term}*`, `memo.ilike.*${term}*`];
  const amount = parseYen(term);
  if (amount !== null) conditions.push(`amount.eq.${amount}`);
  if (matchedCategoryIds.length > 0) conditions.push(`category_id.in.(${matchedCategoryIds.join(',')})`);
  return conditions.join(',');
}
