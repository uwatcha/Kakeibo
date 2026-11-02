import type { Category } from '@/features/categories/api';
import { ADJUSTMENT_KEY, ADJUSTMENT_LABEL } from '@/features/transactions/items';

export type CategoryExpenseRow = { category_id: string | null; amount: number | null };

export type BreakdownItem = {
  /** null は未分類 */
  categoryId: string | null;
  name: string;
  amount: number;
  /** 0〜1 */
  ratio: number;
};

/**
 * 大分類別の支出を多い順に並べる。内訳の調整の行（割引・調整）は、マイナスでも出して最後に置く
 * （割合はプラスの区分の合計に対して。マイナスの区分は割合 0）
 */
export function buildBreakdown(rows: readonly CategoryExpenseRow[], categories: readonly Category[]): BreakdownItem[] {
  const total = rows.reduce((sum, r) => sum + Math.max(0, r.amount ?? 0), 0);
  const isAdjustment = (r: CategoryExpenseRow) => r.category_id === ADJUSTMENT_KEY;
  return rows
    .filter((r) => (r.amount ?? 0) > 0 || (isAdjustment(r) && (r.amount ?? 0) !== 0))
    .map((r) => ({
      categoryId: r.category_id,
      name: isAdjustment(r) ? ADJUSTMENT_LABEL : (categories.find((c) => c.id === r.category_id)?.name ?? '未分類'),
      amount: r.amount ?? 0,
      ratio: total > 0 ? Math.max(0, r.amount ?? 0) / total : 0,
    }))
    .sort(
      (a, b) =>
        Number(a.categoryId === ADJUSTMENT_KEY) - Number(b.categoryId === ADJUSTMENT_KEY) ||
        b.amount - a.amount ||
        a.name.localeCompare(b.name, 'ja'),
    );
}

export type DonutSlice = { key: string; name: string; amount: number; ratio: number; isOther: boolean };

/** 円グラフは区分が多いと読めないので、上位 maxSlices 件＋「その他」にまとめる */
export function toDonutSlices(all: readonly BreakdownItem[], maxSlices = 5): DonutSlice[] {
  // 円グラフにはプラスの区分だけ（割引・調整のマイナスは描けない）
  const items = all.filter((i) => i.amount > 0);
  const head = items.slice(0, maxSlices).map((i) => ({
    key: i.categoryId ?? 'uncategorized',
    name: i.name,
    amount: i.amount,
    ratio: i.ratio,
    isOther: false,
  }));
  const rest = items.slice(maxSlices);
  if (rest.length === 0) return head;
  return [
    ...head,
    {
      key: 'other',
      name: `その他（${rest.length}）`,
      amount: rest.reduce((sum, i) => sum + i.amount, 0),
      ratio: rest.reduce((sum, i) => sum + i.ratio, 0),
      isOther: true,
    },
  ];
}

export type Comparison = {
  current: number;
  previous: number;
  diff: number;
  /** 前月が 0 なら null */ rate: number | null;
};

export function compare(current: number, previous: number): Comparison {
  return { current, previous, diff: current - previous, rate: previous > 0 ? (current - previous) / previous : null };
}
