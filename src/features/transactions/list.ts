import type { Transaction } from './api';

export type DaySection = { date: string; data: Transaction[] };

/** 日付ごとにまとめる。入力の並び（新しい日付順）をそのまま保つ */
export function groupByDate(transactions: readonly Transaction[]): DaySection[] {
  const sections: DaySection[] = [];
  for (const t of transactions) {
    const last = sections[sections.length - 1];
    if (last && last.date === t.date) last.data.push(t);
    else sections.push({ date: t.date, data: [t] });
  }
  return sections;
}

/** 月の収入・支出。集計に入るのは支払いと収入だけ（REQ-34）。未確認の記録（予定・確認待ち）は入れない */
export function monthTotals(transactions: readonly Transaction[]): { income: number; expense: number } {
  let income = 0;
  let expense = 0;
  for (const t of transactions) {
    if (!t.is_confirmed) continue;
    if (t.type === 'income') income += t.amount;
    else if (t.type === 'expense') expense += t.amount;
  }
  return { income, expense };
}

/** その日の支出（確認済みの支払いだけの合計）。記録画面の日付の見出しに出す */
export function dayExpense(section: DaySection): number {
  return section.data.reduce((sum, t) => (t.type === 'expense' && t.is_confirmed ? sum + t.amount : sum), 0);
}
