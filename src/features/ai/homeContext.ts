import { type HomeFigures, shortfallTitle, untilPaydayLabel } from '@/features/home/figures';
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
    `- 実質残高: ${formatYen(available.amount)}${available.cardHorizon ? `（${available.cardHorizon}までの予定 ${formatYen(available.planned)} を含む）` : ''}`,
    `- 純資産: ${formatYen(summary.netWorth)}`,
  );
  if (budget) {
    const { result } = budget;
    const title = result.amount < 0 ? shortfallTitle(budget) : budget.title;
    const until = untilPaydayLabel(budget);
    lines.push(
      `- ${title}: ${formatYen(Math.abs(result.amount))}（${budget.through}まで・あと${budget.daysLeft}日${budget.perDay !== null ? `・1日あたり ${formatYen(budget.perDay)}` : ''}）`,
      `  - 内訳: 今の残高（現金・銀行など）${formatYen(budget.cashBalance)} / 予定 ${formatYen(result.planned)} / 今の期間のクレカの利用 −${formatYen(result.cardUsage)} / 取り置き −${formatYen(result.reserve)}`,
      ...result.shortfalls.map((f) => `  - 取り置きの内訳: ${f.from}〜${f.to}の不足 ${formatYen(f.amount)}`),
      `- ${until.label}: ${formatYen(until.amount)}`,
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
