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
    ).toEqual({ title: '支払いを記録しました', body: 'セブンイレブン 580円', data: { transactionId: 't' } });
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
