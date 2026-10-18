import { addDays } from '@/lib/date';

type Movement = { date: string; amount: number; from_account_id: string | null; to_account_id: string | null };

export type BalancePoint = { date: string; balance: number };

/**
 * start〜end の各日の終わり時点の残高（汎用資産など、対象の口座の合計）。
 * currentBalance は movements をすべて反映した残高。そこから、その日より後の記録の動きを差し戻して求める。
 * movements には start より後で currentBalance に含まれている記録をすべて渡す。
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

/**
 * 今日から次の給料日までの予測。前回の給料日から今日までの1日あたりの平均の増減がそのまま続くとした直線。
 * 先頭は今日の実績と同じ点。前回の給料日が今日なら勢いが出せないので null。
 */
export function projectUntil(actual: readonly BalancePoint[], until: string): BalancePoint[] | null {
  if (actual.length < 2) return null;
  const first = actual[0];
  const last = actual[actual.length - 1];
  const perDay = (last.balance - first.balance) / (actual.length - 1);
  const points: BalancePoint[] = [];
  let k = 0;
  for (let date = last.date; date <= until; date = addDays(date, 1)) {
    points.push({ date, balance: Math.round(last.balance + perDay * k) });
    k += 1;
  }
  return points;
}
