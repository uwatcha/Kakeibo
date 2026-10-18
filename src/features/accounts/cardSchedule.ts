import { actualPayday, scheduledPayday } from '@/features/employers/payday';

export type CardSchedule = { closing_day: number; payment_day: number; payment_month_offset: number };

export type CardCycle = {
  /** この請求の締め日（休みの日でもずらさない） */
  closingDate: string;
  /** 引き落とし日（休みの日は次の平日） */
  paymentDate: string;
};

/** today 以降でいちばん近い引き落としと、その請求の締め日 */
export function nextCardCycle(schedule: CardSchedule, today: string): CardCycle {
  const [year, month] = today.split('-').map(Number);
  // 締め日の月を前後に動かしながら、引き落とし日が今日以降になる最初の回を探す
  for (let delta = -schedule.payment_month_offset - 1; delta <= 2; delta++) {
    const closingIndex = year * 12 + (month - 1) + delta;
    const cy = Math.floor(closingIndex / 12);
    const cm = (closingIndex % 12) + 1;
    const paymentIndex = closingIndex + schedule.payment_month_offset;
    const py = Math.floor(paymentIndex / 12);
    const pm = (paymentIndex % 12) + 1;
    const paymentDate = actualPayday(py, pm, { payday: schedule.payment_day, payday_shift: 'after' });
    if (paymentDate >= today) {
      return { closingDate: scheduledPayday(cy, cm, schedule.closing_day), paymentDate };
    }
  }
  throw new Error('引き落とし日が見つかりません');
}
