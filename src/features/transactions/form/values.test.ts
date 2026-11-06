import type { Category } from '@/features/categories/api';

import type { Transaction } from '../api';
import {
  advanceItems,
  advanceRow,
  emptyFormValues,
  itemRows,
  toFormValues,
  toTransactionRow,
  validateForm,
} from './values';

const base = { user_id: 'u', sort_order: 0, is_archived: false, created_at: '' } as const;
const categories = [
  { ...base, id: 'salary', parent_id: null, kind: 'income', name: '給与・アルバイト' },
  { ...base, id: 'food', parent_id: null, kind: 'expense', name: '食費' },
  { ...base, id: 'social', parent_id: null, kind: 'expense', name: '交際費' },
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

describe('内訳の立て替えの行（2026-11-06）', () => {
  // スーパーの 8,545円のうち、5,400円を友だちに立て替え、2,000円が交際費、残りが食費
  const values = {
    ...emptyFormValues(today),
    amount: '8545',
    fromAccountId: 'bank',
    payee: 'スーパー',
    date: '2026-10-20',
    items: [
      { key: 'a', name: '友だちの分', categoryId: null, amount: '5400', advanceToId: 'friend' },
      { key: 'b', name: '', categoryId: 'social', amount: '2000' },
      { key: 'c', name: '', categoryId: 'food', amount: '1145' },
    ],
  };

  it('支払いは立て替えを引いた自分の分にし、立て替えの行は内訳に入れない', () => {
    expect(validateForm(values, accounts, categories)).toEqual({});
    const row = toTransactionRow(values, categories, today);
    expect(row).toMatchObject({ type: 'expense', amount: 3145, category_id: 'social' });
    expect(itemRows(values)).toEqual([
      { category_id: 'social', name: null, amount: 2000, is_adjustment: false },
      { category_id: 'food', name: null, amount: 1145, is_adjustment: false },
    ]);
  });

  it('立て替えの行は、同じ口座・日付・内容の立て替えの記録にする（品名はメモ）', () => {
    const row = toTransactionRow(values, categories, today);
    expect(advanceItems(values).map((a) => advanceRow(row, 'parent', a))).toEqual([
      {
        type: 'advance',
        amount: 5400,
        from_account_id: 'bank',
        to_account_id: 'friend',
        category_id: null,
        date: '2026-10-20',
        payee: 'スーパー',
        memo: '友だちの分',
        is_confirmed: true,
        split_from_id: 'parent',
      },
    ]);
  });

  it('立て替えだけなら、残りは記録のカテゴリのまま', () => {
    const only = { ...values, categoryId: 'food', items: values.items.slice(0, 1) };
    expect(toTransactionRow(only, categories, today)).toMatchObject({ amount: 3145, category_id: 'food' });
    expect(itemRows(only)).toEqual([]);
  });

  it('立て替えの合計が金額以上なら保存できない', () => {
    const over = { ...values, items: [{ ...values.items[0], amount: '8545' }] };
    expect(validateForm(over, accounts, categories).items).toBe('立て替えの合計は金額より少なくしてください');
  });

  it('開き直すと、金額の欄は立て替えを足した合計、立て替えは内訳の行に戻る', () => {
    const parent = {
      type: 'expense',
      amount: 3145,
      from_account_id: 'bank',
      items: [{ category_id: 'social', name: null, amount: 2000, is_adjustment: false }],
    } as unknown as Transaction;
    const advance = { id: 'adv', amount: 5400, to_account_id: 'friend', memo: '友だちの分' } as unknown as Transaction;
    const form = toFormValues(parent, [advance]);
    expect(form.amount).toBe('8545');
    expect(form.items).toEqual([
      { key: 'item-0', name: '', categoryId: 'social', amount: '2000' },
      {
        key: 'advance-adv',
        name: '友だちの分',
        categoryId: null,
        amount: '5400',
        advanceToId: 'friend',
        advanceId: 'adv',
      },
    ]);
  });
});
