import type { RecurringRule } from './api';
import type { RecurringShift } from './schedule';

export const SHIFT_LABELS: Record<RecurringShift, string> = {
  none: 'そのまま',
  before: '前の平日',
  after: '次の平日',
};

/** 「毎月27日」「2か月ごと26日」「毎月末日」 */
export function scheduleLabel(rule: Pick<RecurringRule, 'day_of_month' | 'interval_months'>): string {
  const every = rule.interval_months === 1 ? '毎月' : `${rule.interval_months}か月ごと`;
  return `${every}${rule.day_of_month === 31 ? '末日' : `${rule.day_of_month}日`}`;
}
