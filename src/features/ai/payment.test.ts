import { matchPaymentAccount } from './payment';

const a = (id: string, name: string, kind: 'cash' | 'bank' | 'emoney' | 'credit_card', is_archived = false) => ({
  id,
  name,
  kind,
  is_archived,
});
const accounts = [
  a('wallet', '財布', 'cash'),
  a('suica', 'モバイル Suica', 'emoney'),
  a('paypay', 'PayPay', 'emoney'),
  a('cardMail', 'サンプルカード', 'credit_card'),
  a('bank', 'サンプル銀行', 'bank'),
];

describe('matchPaymentAccount', () => {
  it('口座の名前・現金・電子マネーの名前から口座を決める', () => {
    expect(matchPaymentAccount('お預り ¥1,000 お釣り ¥220', accounts)).toBe('wallet');
    expect(matchPaymentAccount('サンプルカード（VISA）', accounts)).toBe('cardMail');
    expect(matchPaymentAccount('交通系IC SUICA', accounts)).toBe('suica');
    expect(matchPaymentAccount('ＰａｙＰａｙ', accounts)).toBe('paypay');
  });

  it('クレジットとだけ書かれていたら、クレカの口座が1つのときだけ', () => {
    expect(matchPaymentAccount('クレジット', accounts)).toBe('cardMail');
    expect(matchPaymentAccount('クレジット', [...accounts, a('other', 'エポス', 'credit_card')])).toBeNull();
  });

  it('分からない・書かれていない・非表示の口座は null', () => {
    expect(matchPaymentAccount('QUICPay', accounts)).toBeNull();
    expect(matchPaymentAccount(null, accounts)).toBeNull();
    expect(matchPaymentAccount('現金', [a('wallet', '財布', 'cash', true)])).toBeNull();
  });
});
