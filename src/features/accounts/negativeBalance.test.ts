import { negativeToNotify } from './negativeBalance';

const b = (id: string, kind: 'cash' | 'bank' | 'credit_card' | 'receivable', balance: number, isArchived = false) => ({
  id,
  kind,
  balance,
  isArchived,
});

describe('negativeToNotify', () => {
  it('資産の口座のマイナスだけ（クレカ・相手・しまった口座は除く）', () => {
    const { notify, next } = negativeToNotify(
      [b('cash', 'cash', -100), b('card', 'credit_card', -5000), b('p', 'receivable', -3), b('old', 'bank', -1, true)],
      {},
    );
    expect(notify.map((x) => x.id)).toEqual(['cash']);
    expect(next).toEqual({ cash: -100 });
  });

  it('同じ残高で知らせた口座は知らせず、額が変われば知らせ直す。0 以上に戻れば忘れる', () => {
    expect(negativeToNotify([b('cash', 'cash', -100)], { cash: -100 }).notify).toEqual([]);
    expect(negativeToNotify([b('cash', 'cash', -300)], { cash: -100 }).notify.map((x) => x.id)).toEqual(['cash']);
    expect(negativeToNotify([b('cash', 'cash', 0)], { cash: -100 }).next).toEqual({});
  });
});
