import type { Category } from '@/features/categories/api';

import {
  assignPaymentAccounts,
  draftAccounts,
  draftToRow,
  isDraftReady,
  markDuplicates,
  type PhotoSource,
  toDrafts,
} from './extract';

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

const blank = { duplicate: false, source: 'other' as const, payment: null, note: null };

describe('markDuplicates', () => {
  const d = (
    key: string,
    date: string,
    amount: number,
    payee: string | null = null,
    source: PhotoSource = 'other',
  ) => ({
    ...blank,
    key,
    date,
    type: 'expense' as const,
    amount,
    payee,
    categoryId: null,
    fromAccountId: null,
    toAccountId: null,
    source,
  });

  it('すでにある記録と同じ金額で前後1日以内、読み取りの中の2回目に印を付ける', () => {
    const marked = markDuplicates(
      [
        d('1', '2026-10-21', 100),
        d('2', '2026-10-23', 100),
        d('3', '2026-10-21', 200, 'A'),
        d('4', '2026-10-21', 200, 'A'),
        d('5', '2026-10-21', 200, 'B'),
      ],
      [{ date: '2026-10-20', amount: 100, auto_source: null }],
    );
    expect(marked.map((m) => m.duplicate)).toEqual([true, false, false, true, false]);
  });

  it('セルフレジの画面・自販機は、メールから入った記録と重なれば「メールで記録済み」', () => {
    const [screen, receipt] = markDuplicates(
      [d('1', '2026-10-21', 300, null, 'screen'), d('2', '2026-10-21', 300, null, 'receipt')],
      [{ date: '2026-10-21', amount: 300, auto_source: 'email' }],
    );
    expect(screen).toMatchObject({ duplicate: true, note: 'メールで記録済み' });
    expect(receipt).toMatchObject({ duplicate: true, note: null });
  });
});

describe('assignPaymentAccounts', () => {
  const d = (source: PhotoSource, payment: string | null, note: string | null = null) => ({
    ...blank,
    key: '1',
    date: '2026-10-21',
    type: 'expense' as const,
    amount: 150,
    payee: '自販機（お茶）',
    categoryId: null,
    fromAccountId: null,
    toAccountId: null,
    source,
    payment,
    note,
  });
  const match = (payment: string | null) => (payment === 'サンプルカード' ? 'card' : null);

  it('支払い方法が分かればその口座、分からないセルフレジ・自販機は現金', () => {
    const [byPayment, vending, receipt, emailed] = assignPaymentAccounts(
      [d('receipt', 'サンプルカード'), d('price', null), d('receipt', null), d('screen', null, 'メールで記録済み')],
      match,
      'wallet',
    );
    expect(byPayment).toMatchObject({ fromAccountId: 'card', note: '支払い方法: サンプルカード' });
    expect(vending).toMatchObject({ fromAccountId: 'wallet', note: '現金と判断' });
    expect(receipt.fromAccountId).toBeNull();
    expect(emailed.fromAccountId).toBeNull();
  });
});

describe('draftAccounts / isDraftReady / draftToRow', () => {
  const draft = (type: 'expense' | 'income' | 'transfer', from: string | null, to: string | null) => ({
    ...blank,
    key: '1',
    date: '2026-10-25',
    type,
    amount: 500,
    payee: 'A',
    categoryId: null,
    fromAccountId: from,
    toAccountId: to,
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
