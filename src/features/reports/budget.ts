import { addDays, daysInclusive } from '@/lib/date';

/**
 * 生活費の1日あたりの見積もり: 直近 days 日の確認済みの支払いのうち、定期支払い以外の1日あたりの平均。
 * 記録が days 日分に満たないときは、最初の記録からの日数で割る
 */
export function estimateDailyLiving(
  expenses: readonly { date: string; amount: number; recurring: boolean }[],
  today: string,
  days = 90,
): number {
  const since = addDays(today, -(days - 1));
  const used = expenses.filter((e) => !e.recurring && e.date >= since && e.date <= today);
  if (used.length === 0) return 0;
  const first = used.reduce((min, e) => (e.date < min ? e.date : min), today);
  const span = Math.min(days, daysInclusive(first, today));
  return Math.round(used.reduce((sum, e) => sum + e.amount, 0) / span);
}
