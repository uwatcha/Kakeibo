import type { Category } from '@/features/categories/api';

import { type AiSource, buildAliases, buildContext, maskText, restoreText } from './anonymize';

const category = (id: string, name: string, kind: 'expense' | 'income' = 'expense') =>
  ({ id, name, kind, parent_id: null, user_id: 'u', sort_order: 0, is_archived: false, created_at: '' }) as Category;

const tx = (over: Partial<AiSource['transactions'][number]>) => ({
  date: '2026-10-10',
  type: 'expense' as const,
  amount: 1000,
  from_account_id: 'bank',
  to_account_id: null,
  category_id: 'food',
  payee: null,
  memo: null,
  employer_id: null,
  is_confirmed: true,
  ...over,
});

const source: AiSource = {
  today: '2026-10-20',
  accounts: [
    { id: 'bank', name: 'サンプル銀行', kind: 'bank', balance: 31000, includeInAvailable: true },
    { id: 'kenta', name: '健太', kind: 'receivable', balance: 9000, includeInAvailable: true },
    { id: 'father', name: '父', kind: 'payable', balance: -50000, includeInAvailable: true },
  ],
  categories: [category('food', '食費'), category('salary', '給与・アルバイト', 'income')],
  employers: [{ id: 'emp', name: 'acmeworks', payday: 25, payday_shift: 'before', is_archived: false }],
  transactions: [
    tx({ payee: 'セブンイレブン', memo: '健太と行った' }),
    tx({
      date: '2026-10-23',
      type: 'income',
      amount: 48000,
      from_account_id: null,
      to_account_id: 'bank',
      category_id: 'salary',
      payee: 'acmeworks',
      employer_id: 'emp',
      is_confirmed: false,
    }),
    tx({ type: 'lend', from_account_id: 'bank', to_account_id: 'kenta', category_id: null, payee: 'セブンイレブン' }),
  ],
  rules: [],
};

describe('anonymize', () => {
  const aliases = buildAliases(source);
  const context = buildContext(source, aliases);

  it('口座・相手・勤務先・内容・メモの中身は材料に出さない', () => {
    for (const secret of ['サンプル銀行', '健太', '父', 'acmeworks', 'セブンイレブン', '健太と行った']) {
      expect(context).not.toContain(secret);
    }
  });

  it('置き換え後の名前で材料を作る（同じ内容は同じ名前）', () => {
    expect(context).toContain('銀行A（銀行・実質残高に含む）: 31,000円');
    expect(context).toContain('相手A');
    expect(context).toContain('相手B');
    expect(context).toContain('勤務先A');
    expect(context).toContain('メモあり');
    expect(context.match(/内容1/g)?.length).toBe(2);
    expect(context).toContain('予定・収入元 勤務先A');
  });

  it('質問の中の名前を置き換え、返事の中の名前を元に戻す', () => {
    const masked = maskText('健太への貸しはいつ返ってくる？サンプル銀行は足りる？', aliases);
    expect(masked).toBe('相手Aへの貸しはいつ返ってくる？銀行Aは足りる？');
    expect(restoreText('相手Aから9,000円が戻る予定です。銀行Aは10/27に不足します', aliases)).toBe(
      '健太から9,000円が戻る予定です。サンプル銀行は10/27に不足します',
    );
  });

  it('1文字の名前も置き換える', () => {
    expect(maskText('父に返す', aliases)).toBe('相手Bに返す');
    expect(restoreText('相手Bに返します', aliases)).toBe('父に返します');
  });
});
