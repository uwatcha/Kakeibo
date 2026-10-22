import type { Category } from '@/features/categories/api';

import { draftAccounts, draftToRow, isDraftReady, markDuplicates, toDrafts } from './extract';

const base = { user_id: 'u', sort_order: 0, is_archived: false, created_at: '' } as const;
const categories = [
  { ...base, id: 'food', parent_id: null, kind: 'expense', name: '食費' },
  { ...base, id: 'eatout', parent_id: 'food', kind: 'expense', name: '外食' },
] as Category[];
const accounts = [{ id: 'card' }, { id: 'bank' }];
const aliases = { account: (id: string | null) => (id === 'card' ? 'クレジットカードA' : '銀行A') };

describe('toDrafts', () => {
  it('口座とカテゴリを名前から戻し、形のおかしい行は捨てる', () => {
    const drafts = toDrafts(
      [
        {
          date: '2026-10-20',
          type: 'expense',
          amount: 1200,
          payee: ' ラーメン ',
          category: '食費 / 外食',
          from: 'クレジットカードA',
        },
        { date: '10/20', type: 'expense', amount: 500 },
        { date: '2026-10-20', type: 'expense', amount: -300 },
        { date: '2026-10-21', type: 'income', amount: 1000, from: '銀行A', to: '銀行A', category: 'ない' },
      ],
      accounts,
      categories,
      aliases,
    );
    expect(drafts).toEqual([
      expect.objectContaining({ payee: 'ラーメン', categoryId: 'eatout', fromAccountId: 'card', toAccountId: null }),
      expect.objectContaining({ type: 'income', fromAccountId: null, toAccountId: 'bank', categoryId: null }),
    ]);
  });

  it('配列でなければ空', () => {
    expect(toDrafts({ records: 1 }, accounts, categories, aliases)).toEqual([]);
  });
});

describe('markDuplicates', () => {
  it('すでにある記録と同じ日・金額、読み取りの中の2回目に印を付ける', () => {
    const d = (key: string, date: string, amount: number, payee: string | null = null) => ({
      key,
      date,
      type: 'expense' as const,
      amount,
      payee,
      categoryId: null,
      fromAccountId: null,
      toAccountId: null,
      duplicate: false,
    });
    const marked = markDuplicates(
      [
        d('1', '2026-10-20', 100),
        d('2', '2026-10-21', 200, 'A'),
        d('3', '2026-10-21', 200, 'A'),
        d('4', '2026-10-21', 200, 'B'),
      ],
      [{ date: '2026-10-20', amount: 100 }],
    );
    expect(marked.map((m) => m.duplicate)).toEqual([true, false, true, false]);
  });
});

describe('draftAccounts / isDraftReady / draftToRow', () => {
  const draft = (type: 'expense' | 'income' | 'transfer', from: string | null, to: string | null) => ({
    key: '1',
    date: '2026-10-25',
    type,
    amount: 500,
    payee: 'A',
    categoryId: null,
    fromAccountId: from,
    toAccountId: to,
    duplicate: false,
  });
  const fallback = { payFrom: 'wallet', payTo: 'bank' };

  it('AI が選べなかった口座は、上で選んだ口座を使う。振替は両方 AI が選んだときだけ', () => {
    expect(draftAccounts(draft('expense', null, null), fallback)).toEqual({
      fromAccountId: 'wallet',
      toAccountId: null,
    });
    expect(draftAccounts(draft('income', null, null), fallback)).toEqual({ fromAccountId: null, toAccountId: 'bank' });
    expect(isDraftReady(draft('transfer', 'card', null), fallback)).toBe(false);
    expect(isDraftReady(draft('expense', null, null), { payFrom: null, payTo: null })).toBe(false);
  });

  it('今日より後の日付は未確認で保存する', () => {
    expect(draftToRow(draft('expense', 'card', null), fallback, '2026-10-22')).toMatchObject({
      from_account_id: 'card',
      is_confirmed: false,
    });
  });
});
