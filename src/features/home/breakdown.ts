import { ACCOUNT_KIND_INFO } from '@/features/accounts/accountKinds';
import type { BreakdownRow, BreakdownSection, Formula } from './components/BreakdownSheet';
import { type AccountBalance, availableBreakdown } from '@/features/accounts/summary';
import type { Movement } from '@/features/reports/api';
import { effectOn } from '@/features/reports/plans';
import { TRANSACTION_RULES } from '@/features/transactions/transactionRules';
import { formatDay } from '@/lib/date';
import { formatYen } from '@/lib/money';

import { budgetCard, type BudgetCardKey, type HomeBudget, type HomeFigures } from './figures';

export type HomeSheetKey = 'available' | 'net' | BudgetCardKey;
export type HomeSheet = { title: string; total: number; sections: BreakdownSection[]; note?: string; formulas?: Formula[] };

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

/** 給料日までに残る額（と、それをもとにした額）の土台: 実質残高 ＋ 給料日の前日までの予定 */
function untilPaydaySections(
  budget: HomeBudget,
  figures: HomeFigures,
  accounts: readonly AccountBalance[],
  future: readonly Movement[],
  today: string,
): BreakdownSection[] {
  const { available } = figures;
  const included = accounts
    .filter((a) => available.targets.has(a.id) && a.balance !== 0)
    .sort((a, b) => b.balance - a.balance);
  return [
    { title: '実質残高', total: available.amount, rows: accountRows(included) },
    plannedSection(future, today, budget.through, budget.planned, available.targets),
  ];
}

const livingRow = (key: string, title: string, amount: number): BreakdownRow => ({
  key,
  icon: 'silverware-fork-knife',
  title,
  amount,
  kind: 'delta',
});

/** 給料日までの3つの額の内訳 */
function budgetSheet(
  key: BudgetCardKey,
  budget: HomeBudget,
  figures: HomeFigures,
  accounts: readonly AccountBalance[],
  future: readonly Movement[],
  today: string,
): HomeSheet {
  const card = budgetCard(budget, key);
  const base = untilPaydaySections(budget, figures, accounts, future, today);
  const untilTitle = budgetCard(budget, 'untilPayday').title;
  // 働き先がなければ月末で区切るので、項の名前も「月末まで」にする
  const until = budget.hasPayday ? '給料日' : '月末';
  const plannedLabel = budget.hasPayday ? '給料日の前日までの予定' : '月末までの予定';
  const perDay = (amount: number) =>
    amount > 0 ? `1日あたり ${formatYen(Math.floor(amount / budget.daysLeft))}（あと${budget.daysLeft}日）` : undefined;
  switch (key) {
    case 'untilPayday':
      return {
        title: card.title,
        total: card.amount,
        sections: base,
        note: perDay(card.amount),
        formulas: [
          {
            result: card.title,
            terms: [
              { label: '実質残高', value: figures.available.amount },
              { op: '＋', label: plannedLabel, value: budget.planned },
            ],
          },
        ],
      };
    case 'afterReserve': {
      const { next } = budget;
      const living = budget.dailyLiving * next.days;
      return {
        title: card.title,
        total: card.amount,
        sections: [
          { title: untilTitle, total: budget.untilPayday, rows: [] },
          {
            title: `取り置き（${formatDay(next.from)}〜${formatDay(next.through)}に足りない分）`,
            total: 0 - budget.reserve,
            rows: [
              ...plannedSection(future, budget.through, next.through, next.planned, figures.available.targets).rows,
              livingRow('living', `生活費 ${formatYen(budget.dailyLiving)} × ${next.days}日`, 0 - living),
            ],
          },
        ],
        formulas: [
          {
            result: card.title,
            terms: [
              { label: untilTitle, value: budget.untilPayday },
              { op: '−', label: '取り置き', value: budget.reserve },
            ],
          },
          {
            result: '取り置き',
            terms: [
              { label: '次の期間の生活費', value: living },
              { op: '−', label: '次の期間の予定（給料を含む）', value: next.planned },
            ],
            note: `次の期間: ${formatDay(next.from)}〜${formatDay(next.through)}（${next.days}日）。生活費 ${formatYen(budget.dailyLiving)} × ${next.days}日。マイナスなら 0`,
          },
        ],
      };
    }
    case 'free':
      return {
        title: card.title,
        total: card.amount,
        sections: [
          { title: untilTitle, total: budget.untilPayday, rows: [] },
          {
            title: `${until}までの生活費`,
            total: 0 - budget.livingUntil,
            rows: [
              livingRow(
                'living',
                `生活費 ${formatYen(budget.dailyLiving)} × ${budget.daysLeft}日`,
                0 - budget.livingUntil,
              ),
            ],
          },
        ],
        note: perDay(card.amount),
        formulas: [
          {
            result: card.title,
            terms: [
              { label: untilTitle, value: budget.untilPayday },
              { op: '−', label: `${until}までの生活費`, value: budget.livingUntil },
            ],
          },
          {
            result: `${until}までの生活費`,
            terms: [
              { label: '生活費（1日）', value: budget.dailyLiving },
              { op: '×', label: `${until}までの日数`, value: budget.daysLeft, unit: 'day' },
            ],
          },
        ],
      };
  }
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
        ],
        formulas: [
          {
            result: '実質残高',
            terms: [
              { label: 'プラスの口座', value: split.plusTotal },
              { op: '＋', label: 'マイナスの口座（クレカの未払いなど）', value: split.minusTotal },
            ],
          },
        ],
      };
    }
    case 'net': {
      const assets = accounts.filter((a) => a.balance > 0).sort((a, b) => b.balance - a.balance);
      const debts = accounts.filter((a) => a.balance < 0).sort((a, b) => a.balance - b.balance);
      const assetTotal = assets.reduce((t, a) => t + a.balance, 0);
      const debtTotal = debts.reduce((t, a) => t + a.balance, 0);
      return {
        title: '純資産',
        total: summary.netWorth,
        sections: [
          { title: '資産', total: assetTotal, rows: accountRows(assets) },
          { title: '負債', total: debtTotal, rows: accountRows(debts) },
        ],
        formulas: [
          {
            result: '純資産',
            terms: [
              { label: '資産（すべての口座のプラス）', value: assetTotal },
              { op: '＋', label: '負債（すべての口座のマイナス）', value: debtTotal },
            ],
          },
        ],
      };
    }
    default:
      return figures.budget && future ? budgetSheet(key, figures.budget, figures, accounts, future, today) : null;
  }
}
