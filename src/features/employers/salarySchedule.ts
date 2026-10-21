import { addDays } from '@/lib/date';

import type { Employer } from './api';
import { paydaysBetween, scheduledPayday } from './payday';

/** 給料の予定を入れる先の月数（今日から2か月後の同じ日まで） */
export const SALARY_AHEAD_MONTHS = 2;

/** 今日から months か月後の同じ日（その月にない日は月末） */
export function monthsLater(today: string, months: number): string {
  const [y, m, d] = today.split('-').map(Number);
  const index = y * 12 + (m - 1) + months;
  return scheduledPayday(Math.floor(index / 12), (index % 12) + 1, d);
}

/**
 * まだ予定を入れていない給料日（前回入れたところの次から、2か月後まで）。
 * 初めてなら今日の給料日から入れる
 */
export function pendingSalaryDates(
  employer: Pick<Employer, 'payday' | 'payday_shift' | 'salary_generated_until'>,
  today: string,
): string[] {
  const after = employer.salary_generated_until ?? addDays(today, -1);
  return paydaysBetween(employer, after, monthsLater(today, SALARY_AHEAD_MONTHS));
}
