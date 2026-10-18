import { scheduledPayday, shiftToBusinessDay } from '@/features/employers/payday';
import type { Database } from '@/types/database';

export type RecurringShift = Database['public']['Enums']['recurring_shift'];

export type RecurringSchedule = {
  day_of_month: number;
  interval_months: number;
  /** 最初の回の月（YYYY-MM-DD）。この日より前の回は作らない */
  start_date: string;
  holiday_shift: RecurringShift;
};

const monthIndex = (date: string) => Number(date.slice(0, 4)) * 12 + Number(date.slice(5, 7)) - 1;

/** その回の実際の日付（31 は月末、休みの日の扱いに合わせてずらす） */
function occurrenceOn(schedule: RecurringSchedule, index: number): { scheduled: string; actual: string } {
  const scheduled = scheduledPayday(Math.floor(index / 12), (index % 12) + 1, schedule.day_of_month);
  const actual = schedule.holiday_shift === 'none' ? scheduled : shiftToBusinessDay(scheduled, schedule.holiday_shift);
  return { scheduled, actual };
}

/** after より後〜until までの回の日付（古い順）。after が null なら最初の回から */
export function occurrencesBetween(schedule: RecurringSchedule, after: string | null, until: string): string[] {
  const dates: string[] = [];
  const last = monthIndex(until) + 1; // ずらして翌月にかかる回も拾う
  for (let index = monthIndex(schedule.start_date); index <= last; index += schedule.interval_months) {
    const { scheduled, actual } = occurrenceOn(schedule, index);
    if (scheduled < schedule.start_date) continue;
    if ((after === null || actual > after) && actual <= until) dates.push(actual);
  }
  return dates;
}

/** today 以降でいちばん近い回（なければ null） */
export function nextOccurrence(schedule: RecurringSchedule, today: string): string | null {
  const yearLater = `${Number(today.slice(0, 4)) + 2}${today.slice(4)}`;
  const dates = occurrencesBetween(schedule, null, yearLater).filter((d) => d >= today);
  return dates[0] ?? null;
}
