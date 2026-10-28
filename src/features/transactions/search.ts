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

/**
 * 項目ごとの絞り込み（2026-10-28 改善要望: Notion のフィルターのように、項目ごとの値を選んで探す）。
 * どれも空なら絞り込まない。複数の項目はすべてに当てはまるもの（AND）、1つの項目の中で複数の値はどれか（OR）
 */
export type SearchFilters = {
  types: string[];
  /** 出金元か入金先がこの口座 */
  accountIds: string[];
  /** 大分類を選ぶと小分類も含む（expandCategoryIds） */
  categoryIds: string[];
  from: string | null;
  to: string | null;
  amountMin: number | null;
  amountMax: number | null;
  /** manual = 手入力（auto_source なし）、email、photo */
  sources: ('manual' | 'email' | 'photo')[];
};

export const EMPTY_FILTERS: SearchFilters = {
  types: [],
  accountIds: [],
  categoryIds: [],
  from: null,
  to: null,
  amountMin: null,
  amountMax: null,
  sources: [],
};

/** 絞り込みの項目がどれか選ばれているか */
export function hasFilters(f: SearchFilters): boolean {
  return (
    f.types.length > 0 ||
    f.accountIds.length > 0 ||
    f.categoryIds.length > 0 ||
    f.from !== null ||
    f.to !== null ||
    f.amountMin !== null ||
    f.amountMax !== null ||
    f.sources.length > 0
  );
}

/** 選んだカテゴリに、その小分類を足す */
export function expandCategoryIds(
  ids: readonly string[],
  categories: readonly { id: string; parent_id: string | null }[],
): string[] {
  const set = new Set(ids);
  for (const c of categories) if (c.parent_id && set.has(c.parent_id)) set.add(c.id);
  return [...set];
}

/** 入力元の絞り込みを PostgREST の or フィルタにする（手入力は auto_source が null） */
export function sourceFilter(sources: SearchFilters['sources']): string | null {
  if (sources.length === 0) return null;
  return sources.map((s) => (s === 'manual' ? 'auto_source.is.null' : `auto_source.eq.${s}`)).join(',');
}
