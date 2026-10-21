import { monthsLater, pendingSalaryDates } from './salarySchedule';

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
