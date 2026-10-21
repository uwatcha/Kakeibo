import { ACCOUNT_KIND_INFO } from '@/features/accounts/accountKinds';
import type { BreakdownRow, BreakdownSection } from '@/features/accounts/components/BreakdownSheet';
import { type AccountBalance, availableBreakdown } from '@/features/accounts/summary';
import type { Movement } from '@/features/reports/api';
import { effectOn } from '@/features/reports/plans';
import { TRANSACTION_RULES } from '@/features/transactions/transactionRules';
import { formatDay } from '@/lib/date';
import { formatYen } from '@/lib/money';

import { type HomeBudget, type HomeFigures, untilPaydayLabel } from './figures';

export type HomeSheetKey = 'available' | 'net' | 'spendable';
export type HomeSheet = { title: string; total: number; sections: BreakdownSection[]; note?: string };

const accountRows = (list: readonly AccountBalance[]): BreakdownRow[] =>
  list.map((a) => ({
    key: a.id,
    icon: ACCOUNT_KIND_INFO[a.kind].icon,
    title: a.name,
    amount: a.balance,
    kind: 'balance',
  }));

/** 今日より後、through までの予定のうち、対象の口座の残高を動かすもの（対象の口座どうしの振替は入れない） */
function plannedSection(
  future: readonly Movement[],
  today: string,
  through: string,
  total: number,
  targets: ReadonlySet<string>,
): BreakdownSection {
  const rows = future
    .filter((m) => m.date > today && m.date <= through)
    .map((m) => ({ m, effect: effectOn(m, (id) => targets.has(id)) }))
    .filter(({ effect }) => effect !== 0)
    .sort((a, b) => a.m.date.localeCompare(b.m.date))
    .map(({ m, effect }): BreakdownRow => ({
      key: m.id,
      icon: TRANSACTION_RULES[m.type].icon,
      title: m.payee || TRANSACTION_RULES[m.type].label,
      subtitle: formatDay(m.date),
      amount: effect,
      kind: 'delta',
    }));
  return { title: `予定（${formatDay(through)}まで）`, total, rows };
}

/** 給料日までに使える額の内訳: 今の残高・予定・今の期間のクレカの利用・取り置き */
function budgetSheet(budget: HomeBudget, future: readonly Movement[], today: string): HomeSheet {
  const { result } = budget;
  const until = untilPaydayLabel(budget);
  return {
    title: budget.title,
    total: result.amount,
    note: [
      `${until.label} ${formatYen(until.amount)}`,
      budget.perDay !== null ? `1日あたり ${formatYen(budget.perDay)}（あと${budget.daysLeft}日）` : null,
    ]
      .filter(Boolean)
      .join('・'),
    sections: [
      {
        title: '今の残高（現金・銀行など）',
        total: budget.cashBalance,
        rows: accountRows(budget.cashAccounts.filter((a) => a.balance !== 0).sort((a, b) => b.balance - a.balance)),
      },
      plannedSection(future, today, budget.through, result.planned, budget.cashIds),
      {
        title: '今の期間のクレカの利用',
        total: 0 - result.cardUsage,
        rows:
          result.cardUsage > 0
            ? [
                {
                  key: 'card',
                  icon: 'credit-card',
                  title: '給料日の後に引き落とされる分',
                  amount: 0 - result.cardUsage,
                  kind: 'delta',
                },
              ]
            : [],
      },
      {
        title: '取り置き（先の給料で足りない分）',
        total: 0 - result.reserve,
        rows: result.shortfalls.map((f) => ({
          key: f.from,
          icon: 'piggy-bank-outline',
          title: `${formatDay(f.from)}〜${formatDay(f.to)}の不足`,
          amount: 0 - f.amount,
          kind: 'delta',
        })),
      },
    ],
  };
}

/** ホームのカードを押したときの内訳 */
export function homeSheet(
  key: HomeSheetKey,
  figures: HomeFigures,
  accounts: readonly AccountBalance[],
  future: readonly Movement[] | undefined,
  today: string,
): HomeSheet | null {
  const { summary, available } = figures;
  switch (key) {
    case 'available': {
      const split = availableBreakdown(accounts);
      return {
        title: '実質残高',
        total: available.amount,
        sections: [
          { title: 'プラスの口座', total: split.plusTotal, rows: accountRows(split.plus) },
          { title: 'マイナスの口座', total: split.minusTotal, rows: accountRows(split.minus) },
          ...(future && available.cardHorizon
            ? [plannedSection(future, today, available.cardHorizon, available.planned, available.targets)]
            : []),
        ],
      };
    }
    case 'net': {
      const assets = accounts.filter((a) => a.balance > 0).sort((a, b) => b.balance - a.balance);
      const debts = accounts.filter((a) => a.balance < 0).sort((a, b) => a.balance - b.balance);
      return {
        title: '純資産',
        total: summary.netWorth,
        sections: [
          { title: '資産', total: assets.reduce((t, a) => t + a.balance, 0), rows: accountRows(assets) },
          { title: '負債', total: debts.reduce((t, a) => t + a.balance, 0), rows: accountRows(debts) },
        ],
      };
    }
    case 'spendable':
      return figures.budget && future ? budgetSheet(figures.budget, future, today) : null;
  }
}
