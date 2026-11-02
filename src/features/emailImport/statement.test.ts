import { notOnStatement } from './statement';

const sources = [
  { source: 'bank_mail' as const, accountId: 'bank' },
  { source: 'card_mail' as const, accountId: 'card' },
];
const t = (id: string, type: string, from: string | null, to: string | null) => ({
  id,
  type,
  from_account_id: from,
  to_account_id: to,
});

describe('notOnStatement', () => {
  it('メールの来る口座の手入力で、メールと結び付いていないものだけ', () => {
    const records = [
      t('collect', 'collect', 'friend', 'bank'), // 銀行への入金（連携サービス は入金も来る）
      t('matched', 'expense', 'bank', null), // メールが重複として結び付いた
      t('cash', 'expense', 'wallet', null), // メールの来ない口座
      t('cardUse', 'expense', 'card', null), // カードで使った
      t('cardPay', 'transfer', 'other', 'card'), // カードへの入金はカードのメールでは来ない
      t('adjust', 'adjustment', null, 'bank'), // 残高調整は見ない
    ];
    expect(notOnStatement(records, sources, new Set(['matched'])).map((r) => r.id)).toEqual(['collect', 'cardUse']);
  });
});
