import { budgetCard, type HomeFigures } from '@/features/home/figures';
import { formatYen } from '@/lib/money';

import type { Aliases } from './anonymize';

/**
 * AI に渡す、ホームの画面に今出ている額（置き換え済み）。
 * 「ホームの〜が…になっている」のような質問に、画面と同じ数字で答えられるようにする
 */
export function homeContext(figures: HomeFigures, aliases: Pick<Aliases, 'account'>): string {
  const { available, summary, budget } = figures;
  const lines = ['## ホームに出ている額（今の画面の表示）'];
  lines.push(
    `- 普段使う口座: ${formatYen(summary.everydayTotal)}`,
    `- 実質残高: ${formatYen(available.amount)}`,
    `- 純資産: ${formatYen(summary.netWorth)}`,
  );
  if (budget) {
    const show = (key: Parameters<typeof budgetCard>[1]) => {
      const card = budgetCard(budget, key);
      return card.amount < 0 ? `${card.shortTitle}: ${formatYen(-card.amount)}` : `${card.title}: ${formatYen(card.amount)}`;
    };
    lines.push(
      `- ${show('untilPayday')}（${budget.through}まで・あと${budget.daysLeft}日${budget.perDay !== null ? `・1日あたり ${formatYen(budget.perDay)}` : ''}。実質残高 ${formatYen(available.amount)} ＋ 予定 ${formatYen(budget.planned)}）`,
      `- ${show('afterReserve')}（取り置き ${formatYen(budget.reserve)} = ${budget.next.from}〜${budget.next.through} の生活費 ${formatYen(budget.dailyLiving * budget.next.days)} − その期間の予定 ${formatYen(budget.next.planned)}。足りれば 0）`,
      `- ${show('free')}（給料日までの生活費 ${formatYen(budget.livingUntil)} = 1日 ${formatYen(budget.dailyLiving)} × ${budget.daysLeft}日 を引いた額）`,
    );
  }
  for (const s of figures.shortages) {
    const cover = figures.covers.get(s.accountId);
    const how = cover?.covered
      ? `振替で足りる（${cover.sources.map((src) => `${aliases.account(src.accountId)}から ${formatYen(src.amount)}`).join('・')}）`
      : '振替でも足りない';
    lines.push(`- 足りなくなる口座: ${aliases.account(s.accountId)} が ${s.date} に ${formatYen(s.lowest)}（${how}）`);
  }
  return lines.join('\n');
}
