import { parseSignedYen } from '@/lib/money';

import { ADJUSTMENT_KEY, adjustmentOf, categoryPieces, mainCategory, toItemDrafts, toItemRows } from './items';

const item = (name: string, categoryId: string | null, amount: string) => ({ key: name, name, categoryId, amount });

describe('内訳', () => {
  it('品目の金額はマイナス（品目の割引）も読む', () => {
    expect(parseSignedYen('120')).toBe(120);
    expect(parseSignedYen('−20')).toBe(-20);
    expect(parseSignedYen('-1,000')).toBe(-1000);
    expect(parseSignedYen('')).toBeNull();
    expect(parseSignedYen('-')).toBeNull();
  });

  it('調整の行 = 合計 − 品目の合計（割引・消費税の端数のずれ）', () => {
    // レシートの合計 1,058円、品目は税込で計算すると 1,060円 → 調整 −2円
    const items = [item('おにぎり', 'food', '540'), item('洗剤', 'daily', '520')];
    expect(adjustmentOf(1058, items)).toBe(-2);
    expect(toItemRows(1058, items)).toEqual([
      { category_id: 'food', name: 'おにぎり', amount: 540, is_adjustment: false },
      { category_id: 'daily', name: '洗剤', amount: 520, is_adjustment: false },
      { category_id: null, name: null, amount: -2, is_adjustment: true },
    ]);
  });

  it('合計と品目の合計が同じなら調整の行は作らない。品目がなければ内訳なし', () => {
    expect(toItemRows(1060, [item('おにぎり', 'food', '540'), item('洗剤', 'daily', '520')])).toHaveLength(2);
    expect(toItemRows(500, [item('空', null, '')])).toEqual([]);
  });

  it('代表のカテゴリは、いちばん金額の大きい品目のもの', () => {
    const rows = toItemRows(1000, [item('a', 'food', '300'), item('b', 'daily', '700')]);
    expect(mainCategory(rows)).toBe('daily');
  });

  it('集計では品目ごとのカテゴリと、調整の行に分ける。内訳がなければ記録のカテゴリ', () => {
    const rows = toItemRows(1058, [item('おにぎり', 'food', '540'), item('洗剤', 'daily', '520')]);
    expect(categoryPieces({ amount: 1058, category_id: 'food', items: rows })).toEqual([
      { categoryId: 'food', amount: 540 },
      { categoryId: 'daily', amount: 520 },
      { categoryId: ADJUSTMENT_KEY, amount: -2 },
    ]);
    expect(categoryPieces({ amount: 500, category_id: 'food', items: [] })).toEqual([{ categoryId: 'food', amount: 500 }]);
  });

  it('編集に読み込むときは、調整の行を除く', () => {
    const rows = toItemRows(1058, [item('おにぎり', 'food', '540')]);
    expect(toItemDrafts(rows).map((d) => [d.name, d.amount])).toEqual([['おにぎり', '540']]);
  });
});
