import type { Transaction } from './api';
import { groupByDate, monthTotals } from './list';

let seq = 0;
function txn(overrides: Partial<Transaction>): Transaction {
  seq += 1;
  return {
    id: `t${seq}`,
    user_id: 'u',
    type: 'expense',
    date: '2026-10-18',
    amount: 100,
    from_account_id: 'wallet',
    to_account_id: null,
    category_id: null,
    payee: null,
    memo: null,
    list_price: null,
    points_used: null,
    created_at: '',
    updated_at: '',
    ...overrides,
  };
}

describe('groupByDate', () => {
  it('同じ日付をまとめ、順番を保つ', () => {
    const list = [txn({ date: '2026-10-18' }), txn({ date: '2026-10-18' }), txn({ date: '2026-10-15' })];
    const sections = groupByDate(list);
    expect(sections.map((s) => [s.date, s.data.length])).toEqual([
      ['2026-10-18', 2],
      ['2026-10-15', 1],
    ]);
  });

  it('空なら空', () => {
    expect(groupByDate([])).toEqual([]);
  });
});

describe('monthTotals', () => {
  it('支払いと収入だけを数え、立て替えや振替は数えない', () => {
    const list = [
      txn({ type: 'expense', amount: 1200 }),
      txn({ type: 'expense', amount: 800 }),
      txn({ type: 'income', amount: 50000, from_account_id: null, to_account_id: 'bank' }),
      txn({ type: 'advance', amount: 800, to_account_id: 'friend' }),
      txn({ type: 'transfer', amount: 15000, to_account_id: 'card' }),
    ];
    expect(monthTotals(list)).toEqual({ income: 50000, expense: 2000 });
  });
});
