import { csvField, transactionsToCsv } from './csv';

describe('csvField', () => {
  it('カンマ・改行・引用符は引用符で囲む', () => {
    expect(csvField('a,b')).toBe('"a,b"');
    expect(csvField('say "hi"')).toBe('"say ""hi"""');
    expect(csvField('1行目\n2行目')).toBe('"1行目\n2行目"');
    expect(csvField(null)).toBe('');
    expect(csvField(1200)).toBe('1200');
  });
});

describe('transactionsToCsv', () => {
  it('古い順に、口座名・カテゴリ名を入れて出す', () => {
    const base = {
      user_id: 'u',
      category_id: null,
      payee: null,
      memo: null,
      list_price: null,
      points_used: null,
      recurring_rule_id: null,
      updated_at: '',
      is_confirmed: true,
    };
    const csv = transactionsToCsv(
      [
        {
          ...base,
          id: '2',
          type: 'transfer',
          date: '2026-10-27',
          amount: 36000,
          from_account_id: 'bank',
          to_account_id: 'card',
          created_at: 'b',
          payee: 'クレカ',
          recurring_rule_id: 'r',
        },
        {
          ...base,
          id: '1',
          type: 'expense',
          date: '2026-10-17',
          amount: 1500,
          from_account_id: 'paypay',
          to_account_id: null,
          created_at: 'a',
          category_id: 'c',
          memo: 'a,b',
        },
      ],
      (id) => ({ bank: 'サンプル銀行', card: 'サンプルカード', paypay: 'PayPay' })[id ?? ''] ?? '',
      (id) => (id === 'c' ? '交通' : ''),
    );
    expect(csv.split('\r\n')).toEqual([
      '﻿日付,種類,金額,出金元,入金先,カテゴリ,内容,メモ,定期',
      '2026-10-17,支払い,1500,PayPay,,交通,,"a,b",',
      '2026-10-27,振替,36000,サンプル銀行,サンプルカード,,クレカ,,定期',
      '',
    ]);
  });
});
