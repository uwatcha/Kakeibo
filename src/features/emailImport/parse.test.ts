// 本文は実際のメールの形をまねたもの（名前などは置き換えてある）
import { isAtm, isDebitCardName, MAIL_SENDERS, topUpTarget, normalizeText, parseMail } from '../../../supabase/functions/_shared/emailParse';
import { EMAIL_SENDERS } from './appsScript';

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
      items: [
        { kind: 'debit_mail', date: '2026-10-19', amount: 1000, rawPayee: 'ジエイアールヒガシニホンモバイルスイカ' },
      ],
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
    expect(
      parseMail(
        bankMail('サンプル銀行にて出金がありました（サンプルデビット）', '連携サービス\n新着の出金\n10 月 16 日（金）\n￥ 350\nサンプル銀行'),
      ),
    ).toEqual({
      type: 'items',
      items: [{ kind: 'bank_out', date: '2026-10-16', amount: 350, rawPayee: 'サンプルデビット' }],
    });
    // 年をまたぐ: 1月に届いた 12/30 の入金は前の年
    const income = parseMail(
      bankMail(
        'サンプル銀行にて入金がありました（ヤマダ タロウ）',
        '新着の入金 12 月 30 日（水） ￥ 200,000',
        '2027-01-02T00:00:00Z',
      ),
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
      parseMail({
        from: 'card@example.com',
        subject: 'カード利用のお知らせ(家族ご利用分)',
        date: '',
        body: '',
      }).type,
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

describe('電気・ガスの請求のお知らせ', () => {
  const electricity = {
    from: '電力会社お客さま相談センター <electricity@example.com>',
    subject: '【電力会社】電力会社のサイト≪電気料金等の請求のお知らせ≫',
    date: '2026-10-23T04:05:29Z',
    body: [
      'ご使用量とご請求額のお知らせ',
      '○ご請求月',
      ' 2026年10月分',
      '○ご利用場所',
      ' ****',
      '○ご請求金額',
      ' 6,120円',
      '○ご使用量',
      ' 78kWh',
      '○お支払方法',
      ' クレジットカード',
    ].join('\n'),
  };
  const gas = {
    from: 'gas@example.com',
    subject: 'ガス会社より請求金額確定のお知らせ',
    date: '2026-10-23T09:05:58Z',
    body: ' ガス会社からのお知らせ \n 今月のご利用金額が更新されました。 \n 2026年10月のご利用料金が更新されました。 確認される方はこちらをクリックもしくはタップしてください。 \n 金額を確認する ',
  };

  it('電力会社: 請求月と請求額', () => {
    expect(parseMail(electricity)).toEqual({
      type: 'bill',
      bill: { kind: 'electricity_bill', month: '2026-10', amount: 6120 },
    });
  });

  it('電力会社: 請求額がなければ読み取れない', () => {
    expect(parseMail({ ...electricity, body: 'ご請求月 2026年10月分' }).type).toBe('unreadable');
  });

  it('電力会社: ほかのお知らせは見ない', () => {
    expect(parseMail({ ...electricity, subject: '【電力会社】キャンペーンのお知らせ' }).type).toBe('ignored');
  });

  it('ガス会社: 金額は書かれていないので月だけ', () => {
    expect(parseMail(gas)).toEqual({ type: 'bill', bill: { kind: 'gas_bill', month: '2026-10', amount: null } });
  });

  it('Apps Script の最初の送信元の一覧は、サーバーの一覧と同じ', () => {
    expect([...EMAIL_SENDERS]).toEqual(MAIL_SENDERS);
  });
});

describe('isAtm', () => {
  it('連携サービス の ATM の引き出し・預け入れ', () => {
    expect(isAtm('ATM から現金引出')).toBe(true);
    expect(isAtm('ＡＴＭから現金預入')).toBe(true);
    expect(isAtm('アクメワークス')).toBe(false);
    expect(isAtm(null)).toBe(false);
  });
});

describe('topUpTarget（電子マネーへの入金）', () => {
  const accounts = [
    { id: 'bank', name: 'サンプル銀行', kind: 'bank', is_archived: false },
    { id: 'emoneya', name: 'サンプル電子マネー', kind: 'emoney', is_archived: false },
    { id: 'majica', name: 'majica', kind: 'cash', is_archived: false },
    { id: 'suica', name: 'Suica', kind: 'emoney', is_archived: false },
    { id: 'wallet', name: '財布', kind: 'cash', is_archived: false },
  ];
  it('実際のメールの名目から、入金先の口座を決める', () => {
    expect(topUpTarget('サンプルデンシマネーデンシマネーニユウキンサイト', accounts, 'bank')).toBe('emoneya');
    expect(topUpTarget('JD /MAJICA', accounts, 'bank')).toBe('majica');
    expect(topUpTarget('ジエイアールヒガシニホンモバイルスイカ', accounts, 'bank')).toBe('suica');
  });
  it('お店での支払いは入金にしない', () => {
    expect(topUpTarget('ラクテンペイ フアミリーマート', accounts, 'bank')).toBeNull();
    expect(topUpTarget('サンプルデビット', accounts, 'bank')).toBeNull();
    expect(topUpTarget(null, accounts, 'bank')).toBeNull();
  });
});
