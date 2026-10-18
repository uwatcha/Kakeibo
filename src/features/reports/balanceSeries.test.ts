import { dailyBalances } from './balanceSeries';

const isTarget = (id: string) => id !== 'nisa';
const move = (date: string, amount: number, from: string | null, to: string | null) => ({
  date,
  amount,
  from_account_id: from,
  to_account_id: to,
});

describe('dailyBalances', () => {
  it('今の残高から各日の終わりの残高を差し戻す', () => {
    // 10/13 終わりに 100,000 → 10/14 に 1,200 支払い → 10/16 に 800 支払い → 今 98,000
    const points = dailyBalances(
      98000,
      [move('2026-10-14', 1200, 'wallet', null), move('2026-10-16', 800, 'wallet', null)],
      isTarget,
      '2026-10-13',
      '2026-10-16',
    );
    expect(points).toEqual([
      { date: '2026-10-13', balance: 100000 },
      { date: '2026-10-14', balance: 98800 },
      { date: '2026-10-15', balance: 98800 },
      { date: '2026-10-16', balance: 98000 },
    ]);
  });

  it('対象どうしの振替は動かさず、対象外（NISA）への移動は減らす', () => {
    const points = dailyBalances(
      70000,
      [move('2026-10-15', 5000, 'bank', 'wallet'), move('2026-10-15', 30000, 'bank', 'nisa')],
      isTarget,
      '2026-10-14',
      '2026-10-15',
    );
    expect(points.map((p) => p.balance)).toEqual([100000, 70000]);
  });

  it('未来の日付の記録は、今日の終わりの残高から除く', () => {
    // 今の残高 9,900 には 10/23 の 100 円の支払いが入っている
    const points = dailyBalances(9900, [move('2026-10-23', 100, 'wallet', null)], isTarget, '2026-10-17', '2026-10-18');
    expect(points.map((p) => p.balance)).toEqual([10000, 10000]);
  });

  it('記録がなければ横ばい', () => {
    expect(dailyBalances(5000, [], isTarget, '2026-10-17', '2026-10-18').map((p) => p.balance)).toEqual([5000, 5000]);
  });
});
