import { nextCardCycle } from './cardSchedule';

// サンプルカードなど: 月末締め・翌月27日払い
const endOfMonthNext27 = { closing_day: 31, payment_day: 27, payment_month_offset: 1 };

describe('nextCardCycle', () => {
  it('今月の引き落とし日がまだなら、先月締めの分', () => {
    expect(nextCardCycle(endOfMonthNext27, '2026-10-18')).toEqual({
      closingDate: '2026-09-30',
      paymentDate: '2026-10-27',
    });
  });

  it('引き落とし日当日はその回', () => {
    expect(nextCardCycle(endOfMonthNext27, '2026-10-27').paymentDate).toBe('2026-10-27');
  });

  it('引き落とし日を過ぎたら、今月締めの分（翌月）', () => {
    expect(nextCardCycle(endOfMonthNext27, '2026-10-28')).toEqual({
      closingDate: '2026-10-31',
      paymentDate: '2026-11-27',
    });
  });

  it('引き落とし日が休みなら次の平日（2026/12/27 は日曜）', () => {
    expect(nextCardCycle(endOfMonthNext27, '2026-11-28').paymentDate).toBe('2026-12-28');
  });

  it('15日締め・翌々月10日払い', () => {
    const schedule = { closing_day: 15, payment_day: 10, payment_month_offset: 2 };
    // 8/15 締め → 10/10（土）→ 10/13（10/12 はスポーツの日）
    expect(nextCardCycle(schedule, '2026-10-01')).toEqual({ closingDate: '2026-08-15', paymentDate: '2026-10-13' });
  });
});
