import type { PaydayRule, PaydayShift } from './payday';

export const SHIFT_LABELS: Record<PaydayShift, string> = {
  before: '前の平日',
  after: '次の平日',
};

export function paydayLabel(rule: PaydayRule): string {
  return `毎月${rule.payday === 31 ? '末日' : `${rule.payday}日`}・休みの日は${rule.payday_shift === 'before' ? '前倒し' : '後ろ倒し'}`;
}
