import type { Category } from '@/features/categories/api';

export type CategoryExpenseRow = { category_id: string | null; amount: number | null };

export type BreakdownItem = {
  /** null は未分類 */
  categoryId: string | null;
  name: string;
  amount: number;
  /** 0〜1 */
  ratio: number;
};

/** 大分類別の支出を多い順に並べる（category_monthly_expense ビューの行から） */
export function buildBreakdown(rows: readonly CategoryExpenseRow[], categories: readonly Category[]): BreakdownItem[] {
  const total = rows.reduce((sum, r) => sum + (r.amount ?? 0), 0);
  return rows
    .filter((r) => (r.amount ?? 0) > 0)
    .map((r) => ({
      categoryId: r.category_id,
      name: categories.find((c) => c.id === r.category_id)?.name ?? '未分類',
      amount: r.amount ?? 0,
      ratio: total > 0 ? (r.amount ?? 0) / total : 0,
    }))
    .sort((a, b) => b.amount - a.amount || a.name.localeCompare(b.name, 'ja'));
}

export type DonutSlice = { key: string; name: string; amount: number; ratio: number; isOther: boolean };

/** 円グラフは区分が多いと読めないので、上位 maxSlices 件＋「その他」にまとめる */
export function toDonutSlices(items: readonly BreakdownItem[], maxSlices = 5): DonutSlice[] {
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
