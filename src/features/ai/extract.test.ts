import type { Category } from '@/features/categories/api';

import { markDuplicates, toDrafts } from './extract';

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
