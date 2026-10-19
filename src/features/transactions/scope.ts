import type { Category } from '@/features/categories/api';
import type { CategoryExpenseRow } from '@/features/reports/breakdown';

type Movement = { from_account_id: string | null; to_account_id: string | null };

/**
 * 汎用資産に含める口座（ホーム・集計の右上のパネルで選ぶ）が関わる記録か。
 * 支払いは払った口座、収入は入った口座で決まる。振替などはどちらかが含まれていれば対象。
 */
export function touchesAccounts(t: Movement, accountIds: ReadonlySet<string>): boolean {
  return (
    (t.from_account_id !== null && accountIds.has(t.from_account_id)) ||
    (t.to_account_id !== null && accountIds.has(t.to_account_id))
  );
}

/** 支払いを大分類ごとに合計する（小分類は大分類にまとめる。未分類は category_id = null） */
export function categoryExpenseRows(
  transactions: readonly { type: string; amount: number; category_id: string | null }[],
  categories: readonly Category[],
): CategoryExpenseRow[] {
  const totals = new Map<string | null, number>();
  for (const t of transactions) {
    if (t.type !== 'expense') continue;
    const category = categories.find((c) => c.id === t.category_id);
    const key = category ? (category.parent_id ?? category.id) : null;
    totals.set(key, (totals.get(key) ?? 0) + t.amount);
  }
  return [...totals.entries()].map(([category_id, amount]) => ({ category_id, amount }));
}
