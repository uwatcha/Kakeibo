import { parseSignedYen } from '@/lib/money';

/**
 * 1つの記録の内訳（2026-11-02 改善要望）。記録の金額は支払った合計のまま、品目の行（品名・カテゴリ・金額）を持ち、
 * 最後の「調整」の行 = 合計 − 品目の合計 で、割引・消費税の端数のずれなどを吸収する（ユーザーの指定で案C + 調整の行）。
 * 集計のカテゴリ別は内訳で数え、調整の行は「割引・調整」として数える
 */
export type TransactionItem = {
  category_id: string | null;
  name: string | null;
  amount: number;
  is_adjustment: boolean;
};

/** 入力中の品目の行（金額は入力のままの文字。品目ごとの割引はマイナスも書ける） */
export type ItemDraft = { key: string; name: string; categoryId: string | null; amount: string };

/** 集計で調整の行を数えるときのカテゴリの代わり */
export const ADJUSTMENT_KEY = 'adjustment';
export const ADJUSTMENT_LABEL = '割引・調整';

/** 品目の合計（読めない金額は 0） */
export function itemsTotal(items: readonly Pick<ItemDraft, 'amount'>[]): number {
  return items.reduce((sum, i) => sum + (parseSignedYen(i.amount) ?? 0), 0);
}

/** 調整の行の額 = 合計 − 品目の合計 */
export function adjustmentOf(total: number, items: readonly Pick<ItemDraft, 'amount'>[]): number {
  return total - itemsTotal(items);
}

/** 保存する内訳の行: 品目（金額が読めて、品名か金額があるもの）と、0 でなければ調整の行 */
export function toItemRows(total: number, items: readonly ItemDraft[]): TransactionItem[] {
  const rows: TransactionItem[] = items
    .filter((i) => parseSignedYen(i.amount) !== null)
    .map((i) => ({
      category_id: i.categoryId,
      name: i.name.trim() || null,
      amount: parseSignedYen(i.amount)!,
      is_adjustment: false,
    }));
  if (rows.length === 0) return [];
  const adjustment = total - rows.reduce((sum, r) => sum + r.amount, 0);
  return adjustment === 0 ? rows : [...rows, { category_id: null, name: null, amount: adjustment, is_adjustment: true }];
}

/** 内訳があるときの記録のカテゴリ（一覧などに出す代表）: いちばん金額の大きい品目のカテゴリ */
export function mainCategory(items: readonly TransactionItem[]): string | null {
  const products = items.filter((i) => !i.is_adjustment);
  if (products.length === 0) return null;
  return [...products].sort((a, b) => b.amount - a.amount)[0].category_id;
}

/**
 * 集計のための分け方: 内訳があれば品目ごと（調整の行は ADJUSTMENT_KEY）、なければ記録のカテゴリで1つ
 */
export function categoryPieces(t: {
  amount: number;
  category_id: string | null;
  items?: readonly TransactionItem[] | null;
}): { categoryId: string | null; amount: number }[] {
  if (!t.items || t.items.length === 0) return [{ categoryId: t.category_id, amount: t.amount }];
  return t.items.map((i) => ({ categoryId: i.is_adjustment ? ADJUSTMENT_KEY : i.category_id, amount: i.amount }));
}

/** 編集画面に読み込むときの品目の行（調整の行は計算で出すので入れない） */
export function toItemDrafts(items: readonly TransactionItem[] | null | undefined): ItemDraft[] {
  return (items ?? [])
    .filter((i) => !i.is_adjustment)
    .map((i, n) => ({ key: `item-${n}`, name: i.name ?? '', categoryId: i.category_id, amount: String(i.amount) }));
}
