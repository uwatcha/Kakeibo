import { addDays } from '@/lib/date';

import type { Movement } from './api';

/**
 * 給料日までに使える額（2026-10-21 の改善要望。案2と案3を組み合わせた考え方）
 *
 * - クレカの利用は「使った給料期間の支出」として数える。今の期間にクレカで使った分は、引き落としが先でも今の額から引く
 *   （クレカを使えば今月はノーリスク、にならないように）
 * - 前の期間に使った分の請求は、給料日より前に引き落とされるなら今のお金から払い、
 *   給料日より後なら次の給料で払える範囲は引かない。払いきれない分だけ今から取り置く
 * - 先の期間（給料日ごと）で「予定の収入（給料の予定を含む）− 予定の支出（クレカの請求を含む）− 生活費」が
 *   足りなければ、その不足を取り置く。余りは次の期間に持ち越す
 */

export type CardUsage = {
  amount: number;
  /** その利用が引き落とされる日。カードの設定がなく分からなければ null（次の期間に引き落とされるとみなす） */
  paymentDate: string | null;
};

export type BudgetInput = {
  today: string;
  /** 実質残高に含める資産の口座（現金・銀行・電子マネー・投資）の今の残高の合計。クレカ・貸し借りは入れない */
  cashBalance: number;
  /** 今日より後の予定（日付が過ぎた未確認の記録は明日の予定として入っているもの） */
  movements: readonly Movement[];
  /** 資産の口座か（上の cashBalance に入れた口座） */
  isCash: (accountId: string) => boolean;
  /** 期間の区切りの給料日（古い順）。[次の給料日, その次, その次の次] なら、今〜次の給料日の前日が今の期間、そのあと2期間を見る */
  paydays: readonly string[];
  /** 今の期間（前回の給料日から今日まで）にクレカで使った額 */
  currentCardUsage: readonly CardUsage[];
  /** 1日あたりの生活費（先の期間の不足を見積もるのに使う） */
  dailyLiving: number;
};

export type Shortfall = { from: string; to: string; amount: number };

export type Budget = {
  /** 給料日までに使える額 */
  amount: number;
  /** 今日の翌日から給料日の前日までの予定（資産の口座の増減。クレカの引き落としを含む） */
  planned: number;
  /** 今の期間のクレカの利用のうち、給料日までの引き落としに入っていない分（今の額から引く） */
  cardUsage: number;
  /** 先の期間の不足に備えて取り置く額 */
  reserve: number;
  /** 先の期間ごとの不足（取り置きの内訳） */
  shortfalls: Shortfall[];
};

const daysBetween = (from: string, to: string) =>
  Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000) + 1;

/** after より後、through まで（through を含む）の予定による、資産の口座の増減 */
function cashEffect(input: BudgetInput, after: string, through: string): number {
  let effect = 0;
  for (const m of input.movements) {
    if (m.date <= after || m.date > through) continue;
    if (m.to_account_id && input.isCash(m.to_account_id)) effect += m.amount;
    if (m.from_account_id && input.isCash(m.from_account_id)) effect -= m.amount;
  }
  return effect;
}

export function computeBudget(input: BudgetInput): Budget {
  const { today, paydays } = input;
  const firstPayday = paydays[0];
  const periodEnd = addDays(firstPayday, -1);
  const planned = cashEffect(input, today, periodEnd);

  // 今の期間のクレカ利用を、引き落とされる期間ごとに分ける
  const usageByPeriod = new Map<number, number>();
  let cardUsage = 0;
  for (const u of input.currentCardUsage) {
    if (u.paymentDate !== null && u.paymentDate <= today) continue; // もう引き落とされている（残高に反映済み）
    if (u.paymentDate !== null && u.paymentDate < firstPayday) continue; // 給料日までの引き落とし（planned に入っている）
    cardUsage += u.amount;
    const k = u.paymentDate === null ? 1 : paydays.findLastIndex((p) => p <= u.paymentDate!) + 1;
    usageByPeriod.set(k, (usageByPeriod.get(k) ?? 0) + u.amount);
  }

  // 先の期間の不足を取り置く（今の期間にクレカで使った分は、今の額から引いて残してあるので、その期間の請求から除く）
  const shortfalls: Shortfall[] = [];
  let carry = 0;
  let reserve = 0;
  for (let k = 1; k < paydays.length; k++) {
    const from = paydays[k - 1];
    const to = addDays(paydays[k], -1);
    const net =
      cashEffect(input, addDays(from, -1), to) +
      (usageByPeriod.get(k) ?? 0) -
      input.dailyLiving * daysBetween(from, to);
    carry += net;
    if (carry < 0) {
      shortfalls.push({ from, to, amount: 0 - carry });
      reserve += 0 - carry;
      carry = 0;
    }
  }

  return {
    amount: input.cashBalance + planned - cardUsage - reserve,
    planned,
    cardUsage,
    reserve,
    shortfalls,
  };
}

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
  const span = Math.min(days, daysBetween(first, today));
  return Math.round(used.reduce((sum, e) => sum + e.amount, 0) / span);
}
