import { effectOn, lastCardPayment, plannedEffect } from './plans';

const isTarget = (id: string) => id !== 'nisa';
const move = (date: string, amount: number, from: string | null, to: string | null) => ({
  date,
  amount,
  from_account_id: from,
  to_account_id: to,
});

describe('plannedEffect', () => {
  it('期間内の予定だけを足し引きする', () => {
    const movements = [
      move('2026-10-18', 999, 'bank', null), // 今日（すでに残高に入っている）
      move('2026-10-20', 9000, 'friend', 'wallet'), // 対象どうし → 0
      move('2026-10-21', 3000, 'wallet', null),
      move('2026-10-23', 48000, null, 'bank'), // 期間外
      move('2026-10-22', 2000, 'bank', 'nisa'), // 対象外へ → 減る
    ];
    expect(plannedEffect(movements, isTarget, '2026-10-18', '2026-10-22')).toBe(-5000);
  });
});

describe('effectOn', () => {
  it('対象に入れば +、出れば −、対象どうしは 0', () => {
    expect(effectOn(move('2026-10-21', 100, null, 'bank'), isTarget)).toBe(100);
    expect(effectOn(move('2026-10-21', 100, 'bank', 'nisa'), isTarget)).toBe(-100);
    expect(effectOn(move('2026-10-21', 100, 'bank', 'wallet'), isTarget)).toBe(0);
  });
});

describe('lastCardPayment', () => {
  const m = (date: string, from: string | null, to: string | null) => ({
    date,
    amount: 100,
    from_account_id: from,
    to_account_id: to,
  });
  const isCard = (id: string) => id === 'card';

  it('含めるクレカへの、今日より後のいちばん後の引き落とし日', () => {
    const movements = [m('2026-10-27', 'bank', 'card'), m('2026-11-27', 'bank', 'card'), m('2026-12-01', 'bank', null)];
    expect(lastCardPayment(movements, isCard, '2026-10-21')).toBe('2026-11-27');
  });

  it('引き落としの予定がなければ null（今日以前は数えない）', () => {
    expect(
      lastCardPayment([m('2026-10-20', 'bank', 'card'), m('2026-10-30', 'bank', 'other')], isCard, '2026-10-21'),
    ).toBeNull();
  });
});
