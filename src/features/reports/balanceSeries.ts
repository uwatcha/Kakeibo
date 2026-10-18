import { addDays } from '@/lib/date';

type Movement = { date: string; amount: number; from_account_id: string | null; to_account_id: string | null };

export type BalancePoint = { date: string; balance: number };

/**
 * start〜end の各日の終わり時点の残高（汎用資産など、対象の口座の合計）。
 * 今の残高から、その日より後の記録の動きを差し戻して求める。
 * movements には start より後の記録をすべて渡す（end より後・未来の日付の記録も含める）。
 */
export function dailyBalances(
  currentBalance: number,
  movements: readonly Movement[],
  isTarget: (accountId: string) => boolean,
  start: string,
  end: string,
): BalancePoint[] {
  const effectByDate = new Map<string, number>();
  for (const m of movements) {
    let effect = 0;
    if (m.to_account_id && isTarget(m.to_account_id)) effect += m.amount;
    if (m.from_account_id && isTarget(m.from_account_id)) effect -= m.amount;
    if (effect !== 0) effectByDate.set(m.date, (effectByDate.get(m.date) ?? 0) + effect);
  }

  // 各日の終わりの残高 = 今の残高 − その日より後の動きの合計
  let balance = currentBalance;
  for (const [date, effect] of effectByDate) {
    if (date > end) balance -= effect;
  }
  const points: BalancePoint[] = [];
  for (let date = end; date >= start; date = addDays(date, -1)) {
    points.push({ date, balance });
    balance -= effectByDate.get(date) ?? 0;
  }
  return points.reverse();
}
