import { holidays } from '@holiday-jp/holiday_jp';

import { addDays } from '@/lib/date';
import type { Database } from '@/types/database';

export type PaydayShift = Database['public']['Enums']['payday_shift'];

export type PaydayRule = { payday: number; payday_shift: PaydayShift };

const pad = (n: number) => String(n).padStart(2, '0');

/** 銀行が動く日か。土日・祝日（振替休日・国民の休日を含む）・年末年始（12/31〜1/3）は動かない */
export function isBusinessDay(dateString: string): boolean {
  const [year, month, day] = dateString.split('-').map(Number);
  const weekday = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
  if (weekday === 0 || weekday === 6) return false;
  if ((month === 12 && day === 31) || (month === 1 && day <= 3)) return false;
  return !(dateString in holidays);
}

/** 決めた日（31 なら月末。その月にない日も月末）を YYYY-MM-DD で返す */
export function scheduledPayday(year: number, month: number, payday: number): string {
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return `${year}-${pad(month)}-${pad(Math.min(payday, lastDay))}`;
}

/** 休みの日なら向きに合わせて平日までずらす */
export function shiftToBusinessDay(date: string, shift: 'before' | 'after'): string {
  const step = shift === 'before' ? -1 : 1;
  let result = date;
  while (!isBusinessDay(result)) result = addDays(result, step);
  return result;
}

/** その月の実際の給料日。休みの日なら向きに合わせて平日までずらす */
export function actualPayday(year: number, month: number, rule: PaydayRule): string {
  return shiftToBusinessDay(scheduledPayday(year, month, rule.payday), rule.payday_shift);
}

function shiftMonth(year: number, month: number, delta: number): [number, number] {
  const index = year * 12 + (month - 1) + delta;
  return [Math.floor(index / 12), (index % 12) + 1];
}

/** today 前後の実際の給料日を古い順に。ずらした結果で月をまたぐことがあるので前後の月も見る */
function paydaysAround(rule: PaydayRule, today: string, monthsBack: number, monthsForward: number): string[] {
  const [year, month] = today.split('-').map(Number);
  const dates: string[] = [];
  for (let delta = -monthsBack; delta <= monthsForward; delta++) {
    const [y, m] = shiftMonth(year, month, delta);
    dates.push(actualPayday(y, m, rule));
  }
  return dates.sort();
}

export type PaydayHit<T> = { date: string; employer: T };

/** 今日まで（今日を含む）でいちばん新しい給料日 */
export function lastPayday<T extends PaydayRule>(employers: readonly T[], today: string): PaydayHit<T> | null {
  let best: PaydayHit<T> | null = null;
  for (const employer of employers) {
    for (const date of paydaysAround(employer, today, 2, 1)) {
      if (date <= today && (!best || date > best.date)) best = { date, employer };
    }
  }
  return best;
}

/** 今日より後でいちばん近い給料日 */
export function nextPayday<T extends PaydayRule>(employers: readonly T[], today: string): PaydayHit<T> | null {
  let best: PaydayHit<T> | null = null;
  for (const employer of employers) {
    for (const date of paydaysAround(employer, today, 1, 2)) {
      if (date > today && (!best || date < best.date)) best = { date, employer };
    }
  }
  return best;
}

/**
 * 集計で月を選んだときの給料日の期間: その月の給料日（start = 前の給料日、end = その月の最初の給料日）。
 * 働き先が複数あれば、いちばん早い給料日で区切る。働き先がなければ null
 */
export function payPeriodForMonth<T extends PaydayRule>(
  employers: readonly T[],
  month: string,
): { start: PaydayHit<T>; end: PaydayHit<T> } | null {
  const end = nextPayday(employers, addDays(month, -1));
  if (!end) return null;
  const start = lastPayday(employers, addDays(end.date, -1));
  return start ? { start, end } : null;
}

/** after より後、through まで（through を含む）の給料日 */
export function paydaysBetween(rule: PaydayRule, after: string, through: string): string[] {
  const [ay, am] = after.split('-').map(Number);
  const [ty, tm] = through.split('-').map(Number);
  const months = (ty - ay) * 12 + (tm - am);
  return paydaysAround(rule, after, 1, months + 1).filter((d) => d > after && d <= through);
}

/**
 * 期間の区切り（ホームの給料日までの額で使う）: 月ごとに、すべての働き先の給料をもらい終える日（その月でいちばん遅い給料日）。
 * after より後、through までを古い順に返す
 */
export function allPaidDays(employers: readonly PaydayRule[], after: string, through: string): string[] {
  const latestByMonth = new Map<string, string>();
  for (const employer of employers) {
    // 月をまたいでずれる給料日もあるので、前後1か月広めに取ってから月ごとにまとめる
    for (const date of paydaysBetween(employer, addDays(after, -40), addDays(through, 40))) {
      const month = date.slice(0, 7);
      const current = latestByMonth.get(month);
      if (!current || date > current) latestByMonth.set(month, date);
    }
  }
  return [...latestByMonth.values()].filter((d) => d > after && d <= through).sort();
}
