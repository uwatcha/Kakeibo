// 本文は実際のメールの形をまねたもの（名前などは置き換えてある）
import { isDebitCardName, normalizeText, parseMail } from '../../../supabase/functions/_shared/emailParse';

const debitMail = {
  from: 'Debit Mail <debit@example.com>',
  subject: 'デビットカードご利用のお知らせ',
  date: '2026-10-19T00:00:31Z',
  body: [
    '**** 様',
    'カード名称 ： サンプルデビット',
    '【ご利用日時(日本時間)】　2026年10月19日 09:00',
    '【ご利用金額】　1,000円',
    '【ご利用先】　ジエイア−ルヒガシニホンモバイルスイカ',
    '【承認番号】　123456',
  ].join('\r\n'),
};

describe('parseMail', () => {
  it('サンプルデビット', () => {
    expect(parseMail(debitMail)).toEqual({
      type: 'items',
      items: [{ kind: 'debit_mail', date: '2026-10-19', amount: 1000, rawPayee: 'ジエイアールヒガシニホンモバイルスイカ' }],
    });
  });

  it('デビットカード の取り消しは知らせるだけ', () => {
    expect(parseMail({ ...debitMail, subject: 'デビットカードご利用取消のお知らせ' }).type).toBe('notice');
  });

  it('連携サービス の出金・入金。年は受信日から決める', () => {
    const bankMail = (subject: string, body: string, date = '2026-10-17T08:40:52Z') => ({
      from: 'Bank Mail <bank@example.com>',
      subject,
      date,
      body,
    });
    expect(parseMail(bankMail('サンプル銀行にて出金がありました（サンプルデビット）', '連携サービス\n新着の出金\n10 月 16 日（金）\n￥ 350\nサンプル銀行'))).toEqual({
      type: 'items',
      items: [{ kind: 'bank_out', date: '2026-10-16', amount: 350, rawPayee: 'サンプルデビット' }],
    });
    // 年をまたぐ: 1月に届いた 12/30 の入金は前の年
    const income = parseMail(
      bankMail('サンプル銀行にて入金がありました（ヤマダ タロウ）', '新着の入金 12 月 30 日（水） ￥ 200,000', '2027-01-02T00:00:00Z'),
    );
    expect(income).toEqual({
      type: 'items',
      items: [{ kind: 'bank_in', date: '2026-12-30', amount: 200000, rawPayee: 'ヤマダ タロウ' }],
    });
  });

  it('サンプルカードの詳細は複数件・半角カナは全角に、速報は店名なし', () => {
    const cardMail = (subject: string, body: string) => ({
      from: 'サンプルカード株式会社 <card@example.com>',
      subject,
      date: '2026-10-09T04:50:55Z',
      body,
    });
    const detail = parseMail(
      cardMail(
        'カード利用のお知らせ(本人ご利用分)',
        '■利用日: 2026/10/08\n■利用先: ｿﾊﾞﾔ\n■利用者: 本人\n■利用金額: 2,400 円\n■利用日: 2026/10/09\n■利用先: フィットネス会費（ＡＢＣ\n■利用金額: 3,500 円',
      ),
    );
    expect(detail).toEqual({
      type: 'items',
      items: [
        { kind: 'card_detail', date: '2026-10-08', amount: 2400, rawPayee: 'ソバヤ' },
        { kind: 'card_detail', date: '2026-10-09', amount: 3500, rawPayee: 'フィットネス会費(ABC' },
      ],
    });
    const quick = parseMail(
      cardMail(
        '【速報版】カード利用のお知らせ(本人ご利用分)',
        '■利用日: 2026/10/08\n■利用者: 本人\n■利用金額: 2,400 円\n■利用日: 2026/10/08\n■利用者: 本人\n■利用金額: 880 円',
      ),
    );
    expect(quick.type === 'items' && quick.items.map((i) => [i.kind, i.amount, i.rawPayee])).toEqual([
      ['card_quick', 2400, null],
      ['card_quick', 880, null],
    ]);
  });

  it('家族の利用分・ほかの送信元は対象外、形が違えば読み取れない', () => {
    expect(
      parseMail({ from: 'card@example.com', subject: 'カード利用のお知らせ(家族ご利用分)', date: '', body: '' }).type,
    ).toBe('ignored');
    expect(parseMail({ from: 'news@example.com', subject: 'x', date: '', body: '' }).type).toBe('ignored');
    expect(parseMail({ ...debitMail, body: '本文が変わった' }).type).toBe('unreadable');
  });
});

describe('normalizeText / isDebitCardName', () => {
  it('全角英数字と半角カナをそろえる', () => {
    expect(normalizeText('ｾﾌﾞﾝｲﾚﾌﾞﾝ　ＡＢＣ店')).toBe('セブンイレブン ABC店');
    expect(isDebitCardName('サンプルデビット')).toBe(true);
    expect(isDebitCardName('ｻﾝﾌﾟﾙｶｰﾄﾞ')).toBe(false);
  });
});
