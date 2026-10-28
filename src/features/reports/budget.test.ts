import { estimateDailyLiving } from './budget';

describe('estimateDailyLiving', () => {
  it('定期支払いを除いた支払いの1日あたりの平均', () => {
    const expenses = [
      { date: '2026-10-12', amount: 3000, recurring: false },
      { date: '2026-10-15', amount: 1000, recurring: false },
      { date: '2026-10-14', amount: 50000, recurring: true },
    ];
    // 10/12〜10/21 の10日
    expect(estimateDailyLiving(expenses, '2026-10-21')).toBe(400);
  });
});
