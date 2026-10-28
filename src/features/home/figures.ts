import { ASSET_KINDS } from '@/features/accounts/accountKinds';
import {
  type AccountBalance,
  type BalanceSummary,
  isAvailableAccount,
  summarizeBalances,
  transferOrder,
} from '@/features/accounts/summary';
import { allPaidDays, nextPayday, type PaydayRule } from '@/features/employers/payday';
import { monthsLater } from '@/features/employers/salarySchedule';
import type { Movement } from '@/features/reports/api';
import { plannedEffect } from '@/features/reports/plans';
import { findShortages, lowestAhead, planCovers, type Shortage, type ShortageCover } from '@/features/reports/shortage';
import { addDays, addMonths, daysInclusive, monthStart } from '@/lib/date';

/** 予定を見る期間の終わり（期限なし） */
const LAST_DATE = '9999-12-31';

/** 期間の区切り: すべての給料をもらい終える日（働き先がなければ月の初め）を、次から2つ */
function upcomingPaydays(employers: readonly PaydayRule[], today: string): string[] {
  if (employers.length === 0) {
    const first = addMonths(monthStart(today), 1);
    return [first, addMonths(first, 1)];
  }
  return allPaidDays(employers, today, monthsLater(today, 4)).slice(0, 2);
}

export type HomeInput = {
  today: string;
  accounts: readonly AccountBalance[];
  /** 非表示でない働き先 */
  employers: readonly PaydayRule[];
  /** 今日より後の予定（日付が過ぎた未確認の記録は明日の予定として入っているもの）。読み込み中なら undefined */
  future?: readonly Movement[];
  /** 1日あたりの生活費。読み込み中なら undefined */
  dailyLiving?: number;
};

/**
 * 給料日まで（働き先がなければ月末まで）の3つの額（2026-10-28 ユーザーの指定。前の「2期間の取り置き」の計算は廃止）。
 * どれも「実質残高に含める」口座だけで数える。含めるクレカの引き落としは含める口座どうしの振替なので増減しない
 */
export type HomeBudget = {
  /** 次の給料日があるか（なければ月末で区切る） */
  hasPayday: boolean;
  /** 今の期間の終わり（次の給料日の前日） */
  through: string;
  /** 今日を含めた残り日数 */
  daysLeft: number;
  /** 今日の翌日から給料日の前日までの予定の増減 */
  planned: number;
  /** 給料日までに残る額 = 実質残高 ＋ planned */
  untilPayday: number;
  /** 1日あたり（給料日までに残る額 ÷ 残り日数）。マイナスなら null */
  perDay: number | null;
  /** 1日あたりの生活費 */
  dailyLiving: number;
  /** 次の期間（次の給料日〜その次の給料日の前日） */
  next: { from: string; through: string; days: number; planned: number };
  /** 取り置き = 次の期間の予定（給料を含む）で、次の期間の生活費が足りない分。足りれば 0 */
  reserve: number;
  /** 取り置き後に使える額 = 給料日までに残る額 − 取り置き */
  afterReserve: number;
  /** 給料日までの生活費 = 生活費（1日）× 残り日数 */
  livingUntil: number;
  /** 自由に使える額 = 給料日までに残る額 − 給料日までの生活費 */
  free: number;
};

export type HomeFigures = {
  summary: BalanceSummary;
  /** 実質残高: 含める口座の今の残高の合計（含めるクレカの未払いを引いた額。先の予定は見ない） */
  available: {
    amount: number;
    /** 実質残高に含める口座 */
    targets: ReadonlySet<string>;
  };
  /** 給料日までの額。予定・生活費が読めていなければ null */
  budget: HomeBudget | null;
  /** 入っている予定（期限なし）で残高がマイナスになる資産の口座（REQ-25） */
  shortages: Shortage<Movement>[];
  /** 振替で切り抜けられるか（口座ごと） */
  covers: ReadonlyMap<string, ShortageCover>;
};

/** ホームのカード（実質残高・純資産・給料日までの3つの額）と、足りなくなる口座の計算 */
export function computeHomeFigures(input: HomeInput): HomeFigures {
  const { today, accounts, employers, future, dailyLiving } = input;
  const summary = summarizeBalances([...accounts]);
  const targets = new Set(accounts.filter(isAvailableAccount).map((a) => a.id));
  const isTarget = (id: string) => targets.has(id);
  const available = summary.availableNetWorth;

  const paydays = upcomingPaydays(employers, today);
  let budget: HomeBudget | null = null;
  if (future && dailyLiving !== undefined && paydays.length >= 2) {
    const through = addDays(paydays[0], -1);
    const daysLeft = Math.max(1, daysInclusive(today, through));
    const planned = plannedEffect(future, isTarget, today, through);
    const untilPayday = available + planned;
    const nextThrough = addDays(paydays[1], -1);
    const next = {
      from: paydays[0],
      through: nextThrough,
      days: daysInclusive(paydays[0], nextThrough),
      planned: plannedEffect(future, isTarget, through, nextThrough),
    };
    const reserve = Math.max(0, dailyLiving * next.days - next.planned);
    const livingUntil = dailyLiving * daysLeft;
    budget = {
      hasPayday: nextPayday(employers, today) !== null,
      through,
      daysLeft,
      planned,
      untilPayday,
      perDay: untilPayday > 0 ? Math.floor(untilPayday / daysLeft) : null,
      dailyLiving,
      next,
      reserve,
      afterReserve: untilPayday - reserve,
      livingUntil,
      free: untilPayday - livingUntil,
    };
  }

  // 入っている予定（来月以降も含めて全部）で残高がマイナスになる口座と、
  // 「振替の優先度」で「振替に使う」にした口座から上から順に振り替えて切り抜けられるか
  const assetBalances = new Map(
    accounts.filter((a) => ASSET_KINDS.includes(a.kind) && !a.isArchived).map((a) => [a.id, a.balance]),
  );
  const shortages = future ? findShortages(assetBalances, future, today, LAST_DATE) : [];
  const covers =
    future && shortages.length > 0
      ? planCovers(shortages, lowestAhead(assetBalances, future, today), transferOrder([...accounts]))
      : new Map<string, ShortageCover>();

  return { summary, available: { amount: available, targets }, budget, shortages, covers };
}

export type BudgetCardKey = 'untilPayday' | 'afterReserve' | 'free';

/**
 * 給料日までの3つのカードの見出しと額。マイナスなら「〜に足りない額」に言い換えて正の額にする
 * （元の見出しは画面で取り消し線で残す。CLAUDE.md のラベル名の好み）
 */
export function budgetCard(budget: HomeBudget, key: BudgetCardKey): { title: string; shortTitle: string; amount: number } {
  const until = budget.hasPayday ? '給料日まで' : '月末まで';
  switch (key) {
    case 'untilPayday':
      return { title: `${until}に残る額`, shortTitle: `${until}に足りない額`, amount: budget.untilPayday };
    case 'afterReserve':
      return { title: '取り置き後に使える額', shortTitle: '取り置きに足りない額', amount: budget.afterReserve };
    case 'free':
      return { title: '自由に使える額', shortTitle: '生活費に足りない額', amount: budget.free };
  }
}
