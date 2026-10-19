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
        { type: 'expense', amount: 100, category_id: 'food' },
        { type: 'expense', amount: 200, category_id: 'eatout' },
        { type: 'expense', amount: 50, category_id: null },
        { type: 'income', amount: 999, category_id: null },
        { type: 'transfer', amount: 999, category_id: null },
      ],
      categories,
    );
    expect(rows).toEqual([
      { category_id: 'food', amount: 300 },
      { category_id: null, amount: 50 },
    ]);
  });
});
