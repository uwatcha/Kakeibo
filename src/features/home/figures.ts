import { ASSET_KINDS } from '@/features/accounts/accountKinds';
import type { CardSchedule } from '@/features/accounts/cardSchedule';
import { paymentDateOf } from '@/features/accounts/cardStatements';
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
import { type Budget, computeBudget } from '@/features/reports/budget';
import { lastCardPayment, plannedEffect } from '@/features/reports/plans';
import { findShortages, lowestAhead, planCovers, type Shortage, type ShortageCover } from '@/features/reports/shortage';
import { addDays, addMonths, daysInclusive, monthStart } from '@/lib/date';

/** 予定を見る期間の終わり（期限なし） */
const LAST_DATE = '9999-12-31';

/**
 * 今の期間の始まり: 前回「すべての給料をもらい終えた日」（月ごとにいちばん遅い給料日）。働き先がなければ月の初め。
 * この日からのクレカの利用を、今の期間の支出として数える
 */
export function currentPeriodStart(employers: readonly PaydayRule[], today: string): string {
  return allPaidDays(employers, addDays(today, -70), today).at(-1) ?? monthStart(today);
}

/** 期間の区切り: すべての給料をもらい終える日（働き先がなければ月の初め）を、次から3つ */
function upcomingPaydays(employers: readonly PaydayRule[], today: string): string[] {
  if (employers.length === 0) {
    const first = addMonths(monthStart(today), 1);
    return [first, addMonths(first, 1), addMonths(first, 2)];
  }
  return allPaidDays(employers, today, monthsLater(today, 4)).slice(0, 3);
}

export type HomeInput = {
  today: string;
  accounts: readonly AccountBalance[];
  /** 非表示でない働き先 */
  employers: readonly PaydayRule[];
  /** 今日より後の予定（日付が過ぎた未確認の記録は明日の予定として入っているもの）。読み込み中なら undefined */
  future?: readonly Movement[];
  /** 今の期間の始まり（currentPeriodStart）の前日より後の記録 */
  periodMovements?: readonly Movement[];
  cardSettings?: readonly (CardSchedule & { account_id: string })[];
  /** 1日あたりの生活費。読み込み中なら undefined */
  dailyLiving?: number;
};

export type HomeBudget = {
  /** 「給料日までに使える額」か「月末までに使える額」（働き先がないとき） */
  title: string;
  /** 次の給料日があるか（なければ月末で区切る） */
  hasPayday: boolean;
  result: Budget;
  /** 今の期間の終わり（次の給料日の前日） */
  through: string;
  /** 今日を含めた残り日数 */
  daysLeft: number;
  /** 1日あたり。使える額がマイナスなら null */
  perDay: number | null;
  /** 計算に使った資産の口座（現金・銀行など。実質残高に含めるもの） */
  cashAccounts: AccountBalance[];
  cashIds: ReadonlySet<string>;
  cashBalance: number;
};

export type HomeFigures = {
  summary: BalanceSummary;
  /** 実質残高（含めるクレカのいちばん後の引き落とし日までの予定も含む） */
  available: {
    amount: number;
    /** 予定の分 */
    planned: number;
    /** 予定を含める期限。引き落としの予定がなければ null */
    cardHorizon: string | null;
    /** 実質残高に含める口座 */
    targets: ReadonlySet<string>;
  };
  /** 給料日までに使える額。材料がそろっていなければ null */
  budget: HomeBudget | null;
  /** 入っている予定（期限なし）で残高がマイナスになる資産の口座（REQ-25） */
  shortages: Shortage<Movement>[];
  /** 振替で切り抜けられるか（口座ごと） */
  covers: ReadonlyMap<string, ShortageCover>;
};

/** ホームのカード（実質残高・純資産・給料日までに使える額）と、足りなくなる口座の計算 */
export function computeHomeFigures(input: HomeInput): HomeFigures {
  const { today, accounts, employers, future } = input;
  const summary = summarizeBalances([...accounts]);

  // 実質残高: 含めるクレカのいちばん後の引き落としの予定日までの、ほかの予定（支出・収入）も含める
  // （クレカの未払いは引き落としで消える前提なので、それまでの予定も合わせて見る）
  const targets = new Set(accounts.filter(isAvailableAccount).map((a) => a.id));
  const includedCards = new Set(
    accounts.filter((a) => a.kind === 'credit_card' && isAvailableAccount(a)).map((a) => a.id),
  );
  const cardHorizon = future ? lastCardPayment(future, (id) => includedCards.has(id), today) : null;
  const planned = future && cardHorizon ? plannedEffect(future, (id) => targets.has(id), today, cardHorizon) : 0;

  // 給料日までに使える額（reports/budget.ts の computeBudget）
  const cashAccounts = accounts.filter((a) => isAvailableAccount(a) && ASSET_KINDS.includes(a.kind) && !a.isArchived);
  const cashIds = new Set(cashAccounts.map((a) => a.id));
  const cashBalance = cashAccounts.reduce((sum, a) => sum + a.balance, 0);
  const paydays = upcomingPaydays(employers, today);
  let budget: HomeBudget | null = null;
  if (future && input.periodMovements && input.cardSettings && input.dailyLiving !== undefined && paydays.length > 0) {
    const periodStart = currentPeriodStart(employers, today);
    const cardSettings = input.cardSettings;
    // 今の期間（前回の給料日から今日まで）に、含めるクレカで使った額と、それが引き落とされる日
    const currentCardUsage = input.periodMovements
      .filter(
        (m) =>
          !m.overdue &&
          m.date >= periodStart &&
          m.date <= today &&
          !!m.from_account_id &&
          includedCards.has(m.from_account_id),
      )
      .map((m) => {
        const schedule = cardSettings.find((c) => c.account_id === m.from_account_id);
        return { amount: m.amount, paymentDate: schedule ? paymentDateOf(schedule, m.date) : null };
      });
    const result = computeBudget({
      today,
      cashBalance,
      movements: future,
      isCash: (id) => cashIds.has(id),
      paydays,
      currentCardUsage,
      dailyLiving: input.dailyLiving,
    });
    const through = addDays(paydays[0], -1);
    const daysLeft = Math.max(1, daysInclusive(today, through));
    const hasPayday = nextPayday(employers, today) !== null;
    budget = {
      title: hasPayday ? '給料日までに使える額' : '月末までに使える額',
      hasPayday,
      result,
      through,
      daysLeft,
      perDay: result.amount > 0 ? Math.floor(result.amount / daysLeft) : null,
      cashAccounts,
      cashIds,
      cashBalance,
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

  return {
    summary,
    available: { amount: summary.availableNetWorth + planned, planned, cardHorizon, targets },
    budget,
    shortages,
    covers,
  };
}

/** 使える額がマイナスのときの言い換え（「給料日までに使える額」→「給料日までに足りない額」） */
export function shortfallTitle(budget: HomeBudget): string {
  return budget.hasPayday ? '給料日までに足りない額' : '月末までに足りない額';
}

/** 次の給料日（働き先がなければ月末）までに残る額。マイナスなら「足りない額」と言い換えて、正の額にする */
export function untilPaydayLabel(budget: HomeBudget): { label: string; amount: number; short: boolean } {
  const until = budget.hasPayday ? '次の給料日まで' : '月末まで';
  const amount = budget.result.untilPayday;
  return amount < 0
    ? { label: `${until}に足りない額`, amount: 0 - amount, short: true }
    : { label: `${until}に残る額`, amount, short: false };
}
