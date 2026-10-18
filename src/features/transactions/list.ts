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

/** 月の収入・支出。集計に入るのは支払いと収入だけ（REQ-34） */
export function monthTotals(transactions: readonly Transaction[]): { income: number; expense: number } {
  let income = 0;
  let expense = 0;
  for (const t of transactions) {
    if (t.type === 'income') income += t.amount;
    else if (t.type === 'expense') expense += t.amount;
  }
  return { income, expense };
}
