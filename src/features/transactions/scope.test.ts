import type { Category } from '@/features/categories/api';

import { categoryExpenseRows, touchesAccounts } from './scope';

describe('touchesAccounts', () => {
  const ids = new Set(['wallet', 'card']);
  it('どちらかの口座が含まれていれば対象', () => {
    expect(touchesAccounts({ from_account_id: 'wallet', to_account_id: null }, ids)).toBe(true);
    expect(touchesAccounts({ from_account_id: 'nisa', to_account_id: 'card' }, ids)).toBe(true);
  });
  it('含まれていない口座だけなら対象外', () => {
    expect(touchesAccounts({ from_account_id: 'nisa', to_account_id: null }, ids)).toBe(false);
    expect(touchesAccounts({ from_account_id: null, to_account_id: 'savings' }, ids)).toBe(false);
  });
});

describe('categoryExpenseRows', () => {
  const base = { user_id: 'u', kind: 'expense', sort_order: 0, is_archived: false, created_at: '' } as const;
  const categories = [
    { ...base, id: 'food', parent_id: null, name: '食費' },
    { ...base, id: 'eatout', parent_id: 'food', name: '外食' },
  ] as Category[];

  it('小分類は大分類にまとめ、支払いだけを数える', () => {
    const rows = categoryExpenseRows(
      [
        { type: 'expense', amount: 100, category_id: 'food', is_confirmed: true },
        { type: 'expense', amount: 7777, category_id: 'food', is_confirmed: false },
        { type: 'expense', amount: 200, category_id: 'eatout', is_confirmed: true },
        { type: 'expense', amount: 50, category_id: null, is_confirmed: true },
        { type: 'income', amount: 999, category_id: null, is_confirmed: true },
        { type: 'transfer', amount: 999, category_id: null, is_confirmed: true },
      ],
      categories,
    );
    expect(rows).toEqual([
      { category_id: 'food', amount: 300 },
      { category_id: null, amount: 50 },
    ]);
  });
});

describe('内訳のある記録の集計', () => {
  it('品目ごとのカテゴリ（小分類は大分類へ）と、割引・調整に分けて数える', () => {
    const categories = [
      { id: 'food', parent_id: null, kind: 'expense', name: '食費', sort_order: 0, is_archived: false, user_id: 'u', created_at: '' },
      { id: 'eatout', parent_id: 'food', kind: 'expense', name: '外食', sort_order: 0, is_archived: false, user_id: 'u', created_at: '' },
      { id: 'daily', parent_id: null, kind: 'expense', name: '日用品', sort_order: 0, is_archived: false, user_id: 'u', created_at: '' },
    ] as const;
    const rows = categoryExpenseRows(
      [
        {
          type: 'expense',
          amount: 1058,
          category_id: 'eatout',
          is_confirmed: true,
          items: [
            { category_id: 'eatout', name: 'おにぎり', amount: 540, is_adjustment: false },
            { category_id: 'daily', name: '洗剤', amount: 520, is_adjustment: false },
            { category_id: null, name: null, amount: -2, is_adjustment: true },
          ],
        },
        { type: 'expense', amount: 300, category_id: 'food', is_confirmed: true },
      ],
      [...categories],
    );
    expect(Object.fromEntries(rows.map((r) => [r.category_id, r.amount]))).toEqual({
      food: 840,
      daily: 520,
      adjustment: -2,
    });
  });
});
