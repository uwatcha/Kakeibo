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

/** 自動の予定のそばにある収入を「もう入っている」とみなす日数（前後） */
export const SALARY_MATCH_DAYS = 7;

/**
 * 予定を入れる日のうち、まだ収入が入っていない日。前後 SALARY_MATCH_DAYS 日に、その収入元の収入か、
 * 同じ入金先・同じ金額の収入（収入元を付けずに手で入れたもの）があれば入れない
 * （2026-11-03: 仕送りを手で入れた日が入金日とずれていて、同じ日だけ見ていたら二重になるところだった）
 */
export function uncoveredDates(
  dates: readonly string[],
  employer: Pick<Employer, 'id' | 'salary_amount' | 'salary_account_id'>,
  incomes: readonly { date: string; amount: number; employer_id: string | null; to_account_id: string | null }[],
): string[] {
  return dates.filter(
    (date) =>
      !incomes.some(
        (t) =>
          t.date >= addDays(date, -SALARY_MATCH_DAYS) &&
          t.date <= addDays(date, SALARY_MATCH_DAYS) &&
          (t.employer_id === employer.id ||
            (t.to_account_id === employer.salary_account_id && t.amount === employer.salary_amount)),
      ),
  );
}
