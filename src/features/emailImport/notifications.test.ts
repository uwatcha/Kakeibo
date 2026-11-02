import { importNotification } from './notifications';

const base = {
  id: '1',
  kind: 'debit_mail',
  amount: 580,
  raw_payee: 'セブンイレブン',
  subject: null,
  transaction_id: 't',
};

describe('importNotification', () => {
  it('記録した支払い・収入', () => {
    expect(
      importNotification({
        ...base,
        status: 'recorded',
        transaction: { payee: 'セブンイレブン', amount: 580, type: 'expense', needs_payee: false },
      }),
    ).toEqual({
      title: '支払いを記録しました',
      body: 'セブンイレブン 580円',
      data: { transactionId: 't' },
      // 内容が分かっているので、通知の「確認」ボタンで確認済みにできる
      confirmable: true,
    });
  });

  it('写真の内容をメールの記録にまとめたときだけ知らせる（メールどうしは知らせない）', () => {
    const transaction = { payee: 'スーパーA', amount: 1700, type: 'expense', needs_payee: false };
    expect(importNotification({ ...base, kind: 'photo', status: 'merged', transaction })).toEqual({
      title: 'レシートの内容を記録に入れました',
      body: 'スーパーA 1,700円',
      data: { transactionId: 't' },
    });
    expect(importNotification({ ...base, kind: 'card_detail', status: 'merged', transaction })).toBeNull();
  });

  it('サンプルカードの速報は「サンプルカード」、内容が分からなければそう添える', () => {
    const quick = importNotification({
      ...base,
      kind: 'card_quick',
      raw_payee: null,
      status: 'recorded',
      transaction: { payee: null, amount: 2400, type: 'expense', needs_payee: false },
    });
    expect(quick?.body).toBe('サンプルカード 2,400円');
    const unknown = importNotification({
      ...base,
      status: 'recorded',
      transaction: { payee: 'ナゾノミセ', amount: 580, type: 'expense', needs_payee: true },
    });
    expect(unknown?.body).toBe('ナゾノミセ 580円（内容を入れてください）');
  });

  it('重複は確認の画面のタブを開き、同じ利用として重ねたものは通知しない', () => {
    expect(importNotification({ ...base, status: 'duplicate', transaction: null })?.data).toEqual({ tab: 'duplicate' });
    expect(importNotification({ ...base, status: 'merged', transaction: null })).toBeNull();
  });
});

describe('電気・ガスの請求のお知らせ', () => {
  const bill = { ...base, status: 'bill', raw_payee: null, transaction: null, subject: '10月分' };

  it('電気: 予定を直したら、押すとその予定を開く', () => {
    expect(importNotification({ ...bill, kind: 'electricity_bill', amount: 6120 })).toEqual({
      title: '電気代の請求が届きました（10月分）',
      body: '6,120円（予定の金額を直しました）',
      data: { transactionId: 't' },
    });
  });

  it('電気: 予定がなければ請求額だけ', () => {
    expect(importNotification({ ...bill, kind: 'electricity_bill', amount: 6120, transaction_id: null })).toEqual({
      title: '電気代の請求が届きました（10月分）',
      body: '6,120円',
      data: {},
    });
  });

  it('ガス: 金額がないので、確かめて入れてもらう', () => {
    expect(importNotification({ ...bill, kind: 'gas_bill', amount: null })?.title).toBe(
      'ガス代の請求額が確定しました（10月分）',
    );
  });
});
