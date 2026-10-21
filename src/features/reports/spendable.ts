import { addDays } from '@/lib/date';

type Movement = { date: string; amount: number; from_account_id: string | null; to_account_id: string | null };

export type Spendable = {
  /** 期間の終わり（この日まで） */
  through: string;
  /** 今日を含めた残り日数 */
  daysLeft: number;
  /** 今の実質残高に、through までの予定（未来の日付の記録）を反映した額 */
  amount: number;
  /** 1日あたり。使える額がマイナスなら null */
  perDay: number | null;
};

/** 対象の口座の残高に対する、after より後〜through までの記録の増減 */
export function plannedEffect(
  movements: readonly Movement[],
  isTarget: (accountId: string) => boolean,
  after: string,
  through: string,
): number {
  let effect = 0;
  for (const m of movements) {
    if (m.date <= after || m.date > through) continue;
    if (m.to_account_id && isTarget(m.to_account_id)) effect += m.amount;
    if (m.from_account_id && isTarget(m.from_account_id)) effect -= m.amount;
  }
  return effect;
}

const daysBetween = (from: string, to: string) =>
  Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86300000);

/** 月末（YYYY-MM-DD） */
export function monthEnd(date: string): string {
  const [year, month] = date.split('-').map(Number);
  return new Date(Date.UTC(year, month, 0)).toISOString().slice(0, 10);
}

/**
 * 次の給料日の前日（給料日がなければ月末）までに使える額。
 * available は今日までの記録で計算した実質残高、movements は今日より後の記録。
 */
export function spendableUntil(
  available: number,
  movements: readonly Movement[],
  isTarget: (accountId: string) => boolean,
  today: string,
  nextPayday: string | null,
): Spendable {
  const through = nextPayday ? addDays(nextPayday, -1) : monthEnd(today);
  const end = through < today ? today : through;
  const amount = available + plannedEffect(movements, isTarget, today, end);
  const daysLeft = daysBetween(today, end) + 1;
  return { through: end, daysLeft, amount, perDay: amount > 0 ? Math.floor(amount / daysLeft) : null };
}

/**
 * 実質残高に予定を含める期限: 実質残高に含めるクレカへの、いちばん後の引き落とし（振替）の予定日。
 * クレカの未払いは引き落としで消える前提なので、それまでの他の予定（支出・収入）も合わせて見る。予定がなければ null
 */
export function lastCardPayment(
  movements: readonly Movement[],
  isIncludedCard: (accountId: string) => boolean,
  today: string,
): string | null {
  let last: string | null = null;
  for (const m of movements) {
    if (m.date > today && m.to_account_id && isIncludedCard(m.to_account_id) && (!last || m.date > last)) {
      last = m.date;
    }
  }
  return last;
}
