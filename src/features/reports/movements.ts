import { addDays } from '@/lib/date';

import type { Movement } from './api';

export type MovementRow = Omit<Movement, 'overdue'> & { is_confirmed: boolean };

/**
 * 未確認の記録は確認するまで残高に入らない（account_balances）ので、日付が過ぎていても予定として扱う。
 * 予定の計算（見込み・足りなくなる口座・推移のグラフ）でそろって扱えるよう、明日の日付にする
 */
export function asMovements(rows: readonly MovementRow[], today: string): Movement[] {
  const tomorrow = addDays(today, 1);
  return rows.map(({ is_confirmed, ...m }) =>
    !is_confirmed && m.date <= today ? { ...m, date: tomorrow, overdue: true } : m,
  );
}
