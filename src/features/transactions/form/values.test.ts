import type { Category } from '@/features/categories/api';

import type { Transaction } from '../api';
import { emptyFormValues, toFormValues, toTransactionRow, validateForm } from './values';

const base = { user_id: 'u', sort_order: 0, is_archived: false, created_at: '' } as const;
const categories = [
  { ...base, id: 'salary', parent_id: null, kind: 'income', name: '給与・アルバイト' },
  { ...base, id: 'food', parent_id: null, kind: 'expense', name: '食費' },
] as Category[];
const accounts = [
  { id: 'bank', kind: 'bank' as const },
  { id: 'friend', kind: 'receivable' as const },
];
const today = '2026-10-21';

describe('validateForm', () => {
  it('給与・アルバイトの収入は収入元が必須', () => {
    const values = { ...emptyFormValues(today), type: 'income' as const, amount: '1000', toAccountId: 'bank' };
    expect(validateForm({ ...values, categoryId: 'salary' }, accounts, categories).employerId).toBe(
      '収入元を選んでください',
    );
    expect(validateForm({ ...values, categoryId: 'salary', employerId: 'e' }, accounts, categories)).toEqual({});
  });

  it('ポイントの欄は空か0以上の整数', () => {
    const values = { ...emptyFormValues(today), amount: '500', fromAccountId: 'bank', categoryId: 'food' };
    expect(validateForm({ ...values, listPrice: 'abc' }, accounts, categories).listPrice).toBeDefined();
    expect(validateForm({ ...values, pointsUsed: '30' }, accounts, categories)).toEqual({});
  });
});

describe('toTransactionRow', () => {
  it('その種類で使わない欄は空にし、未来の日付は未確認で保存する', () => {
    const row = toTransactionRow(
      {
        ...emptyFormValues(today),
        type: 'advance',
        amount: '1200',
        fromAccountId: 'bank',
        toAccountId: 'friend',
        categoryId: 'food',
        employerId: 'e',
        relatedTransactionId: 'x',
        payee: '  夕食 ',
        date: '2026-10-25',
      },
      categories,
      today,
    );
    expect(row).toMatchObject({
      amount: 1200,
      category_id: null,
      employer_id: null,
      related_transaction_id: 'x',
      payee: '夕食',
      is_confirmed: false,
    });
  });

  it('残高調整は向きで口座を振り分ける', () => {
    const row = toTransactionRow(
      {
        ...emptyFormValues(today),
        type: 'adjustment',
        amount: '300',
        fromAccountId: 'bank',
        adjustmentDirection: 'increase',
      },
      categories,
      today,
    );
    expect(row).toMatchObject({ from_account_id: null, to_account_id: 'bank', is_confirmed: true });
  });
});

describe('toFormValues', () => {
  it('減らす向きの残高調整は、口座を fromAccountId に持つ', () => {
    const t = {
      type: 'adjustment',
      amount: 300,
      from_account_id: 'bank',
      to_account_id: null,
      category_id: null,
      date: today,
      payee: null,
      memo: null,
      list_price: null,
      points_used: null,
      employer_id: null,
      related_transaction_id: null,
    } as unknown as Transaction;
    expect(toFormValues(t)).toMatchObject({
      fromAccountId: 'bank',
      toAccountId: null,
      adjustmentDirection: 'decrease',
    });
  });
});
