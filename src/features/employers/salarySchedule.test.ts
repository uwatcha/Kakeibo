import { monthsLater, pendingSalaryDates, uncoveredDates } from './salarySchedule';

describe('monthsLater', () => {
  it('2か月後の同じ日（ない日は月末）', () => {
    expect(monthsLater('2026-10-21', 2)).toBe('2026-12-21');
    expect(monthsLater('2026-12-31', 2)).toBe('2027-02-28');
  });
});

describe('pendingSalaryDates', () => {
  const employer = { payday: 25, payday_shift: 'before' as const };
  it('初めては今日から2か月後まで', () => {
    expect(pendingSalaryDates({ ...employer, salary_generated_until: null }, '2026-10-21')).toEqual([
      '2026-10-23',
      '2026-11-25',
    ]);
  });
  it('前回入れたところの次から', () => {
    expect(pendingSalaryDates({ ...employer, salary_generated_until: '2026-12-21' }, '2026-10-30')).toEqual([
      '2026-12-25',
    ]);
  });
});

describe('uncoveredDates', () => {
  const employer = { id: 'e', salary_amount: 30000, salary_account_id: 'bankb' };
  const income = (date: string, amount: number, employer_id: string | null, to_account_id: string | null) => ({
    date,
    amount,
    employer_id,
    to_account_id,
  });

  it('前後7日に、その収入元の収入か、同じ入金先・同じ金額の収入があれば入れない', () => {
    const incomes = [
      income('2026-11-24', 30000, null, 'bankb'), // 収入元なしで手で入れた仕送り（入金日 11/20 の4日後）
      income('2027-01-15', 38000, 'e', 'bank'), // その収入元の収入（金額・口座が違っても）
      income('2026-12-21', 30000, null, 'bank'), // 入金先が違う
    ];
    expect(uncoveredDates(['2026-11-20', '2026-12-22', '2027-01-22'], employer, incomes)).toEqual(['2026-12-22']);
  });
});
