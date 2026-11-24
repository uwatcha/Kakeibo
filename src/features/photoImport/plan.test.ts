import type { ImportDraft } from '@/features/ai/extract';

import { planPhotoRecords } from './plan';

const d = (values: Partial<ImportDraft>): ImportDraft => ({
  key: '0',
  date: '2026-10-23',
  type: 'expense',
  amount: 500,
  payee: 'コンビニ',
  categoryId: null,
  fromAccountId: null,
  toAccountId: null,
  duplicate: false,
  source: 'receipt',
  payment: null,
  note: null,
  ...values,
});

describe('planPhotoRecords', () => {
  it('支払いで、レシート・決済画面・値段の表示から読んだものだけ。口座が決まらなければ空のまま', () => {
    const plans = planPhotoRecords([
      d({ fromAccountId: 'card', note: '支払い方法: サンプルカード' }),
      d({ source: 'price' }),
      d({ source: 'other' }),
      d({ type: 'income' }),
      d({ duplicate: true, fromAccountId: 'wallet' }),
    ]);
    expect(plans.map((p) => [p.status, p.draft.fromAccountId, p.draft.note])).toEqual([
      ['recorded', 'card', '支払い方法: サンプルカード'],
      ['recorded', null, '口座が分からない'],
      ['duplicate', 'wallet', null],
    ]);
  });
});
