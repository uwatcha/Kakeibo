import type { Category } from '@/features/categories/api';
import type { CategoryExpenseRow } from '@/features/reports/breakdown';

import { ADJUSTMENT_KEY, categoryPieces, type TransactionItem } from './items';

type Movement = { from_account_id: string | null; to_account_id: string | null };

/**
 * 実質残高に含める口座（ホーム・集計の右上のパネルで選ぶ）が関わる記録か。
 * 支払いは払った口座、収入は入った口座で決まる。振替などはどちらかが含まれていれば対象。
 */
export function touchesAccounts(t: Movement, accountIds: ReadonlySet<string>): boolean {
  return (
    (t.from_account_id !== null && accountIds.has(t.from_account_id)) ||
    (t.to_account_id !== null && accountIds.has(t.to_account_id))
  );
}

/**
 * 確認済みの支払いを大分類ごとに合計する（小分類は大分類にまとめる。未分類は category_id = null）。
 * 内訳がある記録は内訳の行ごとに数え、調整の行は ADJUSTMENT_KEY（割引・調整）にまとめる（2026-11-02）
 */
export function categoryExpenseRows(
  transactions: readonly {
    type: string;
    amount: number;
    category_id: string | null;
    is_confirmed: boolean;
    items?: readonly TransactionItem[] | null;
  }[],
  categories: readonly Category[],
): CategoryExpenseRow[] {
  const totals = new Map<string | null, number>();
  for (const t of transactions) {
    // 未確認の記録（予定・確認待ち）は集計に入れない
    if (t.type !== 'expense' || !t.is_confirmed) continue;
    for (const piece of categoryPieces(t)) {
      const category = categories.find((c) => c.id === piece.categoryId);
      const key =
        piece.categoryId === ADJUSTMENT_KEY ? ADJUSTMENT_KEY : category ? (category.parent_id ?? category.id) : null;
      totals.set(key, (totals.get(key) ?? 0) + piece.amount);
    }
  }
  return [...totals.entries()].map(([category_id, amount]) => ({ category_id, amount }));
}
