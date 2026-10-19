import { actualPayday, scheduledPayday } from '@/features/employers/payday';

import { type CardSchedule, nextCardCycle } from './cardSchedule';

export type Statement = {
  /** 締め日（休みの日でもずらさない） */
  closingDate: string;
  /** 引き落とし日（休みの日は次の平日） */
  paymentDate: string;
  /** この回に引き落とされる額（締め日までの利用の合計） */
  amount: number;
  /** まだ締めていない（今後の利用で増える） */
  isOpen: boolean;
};

const monthIndex = (date: string) => {
  const [y, m] = date.split('-').map(Number);
  return y * 12 + (m - 1);
};
const fromIndex = (index: number): [number, number] => [Math.floor(index / 12), (index % 12) + 1];

/** その日の利用が入る回の締め月（月のインデックス） */
function closingMonthOf(schedule: CardSchedule, date: string): number {
  const index = monthIndex(date);
  const [y, m] = fromIndex(index);
  return date <= scheduledPayday(y, m, schedule.closing_day) ? index : index + 1;
}

/**
 * クレカの引き落としを回ごとに出す（新しい回から）。
 * charges はカードから出ていった記録（支払い・立て替えなど）。
 * opening は使い始めたときの未払い額と、使い始めた日。次の引き落としの回に入れる。
 * 利用のない回は出さない（まだ締めていない回は 0 円でも出す）。
 */
export function cardStatements(
  schedule: CardSchedule,
  charges: readonly { date: string; amount: number }[],
  opening: { unpaid: number; since: string } | null,
  today: string,
): Statement[] {
  const totals = new Map<number, number>();
  const add = (closingMonth: number, amount: number) =>
    totals.set(closingMonth, (totals.get(closingMonth) ?? 0) + amount);

  for (const c of charges) add(closingMonthOf(schedule, c.date), c.amount);
  if (opening && opening.unpaid > 0) {
    add(monthIndex(nextCardCycle(schedule, opening.since).closingDate), opening.unpaid);
  }
  // 今の回（まだ締めていない回）は利用がなくても出す
  const openMonth = closingMonthOf(schedule, today);
  if (!totals.has(openMonth)) totals.set(openMonth, 0);

  return [...totals.entries()]
    .sort(([a], [b]) => b - a)
    .map(([index, amount]) => {
      const [cy, cm] = fromIndex(index);
      const [py, pm] = fromIndex(index + schedule.payment_month_offset);
      const closingDate = scheduledPayday(cy, cm, schedule.closing_day);
      return {
        closingDate,
        paymentDate: actualPayday(py, pm, { payday: schedule.payment_day, payday_shift: 'after' }),
        amount,
        isOpen: closingDate >= today,
      };
    });
}
