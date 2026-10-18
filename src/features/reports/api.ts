import { supabase } from '@/lib/supabase';
import type { Database } from '@/types/database';

import type { CategoryExpenseRow } from './breakdown';

export type MonthTotals = { income: number; expense: number };

/** monthly_summary ビューから、指定した月（月初の YYYY-MM-01）の収入・支出を返す。記録がない月は 0 */
export async function fetchMonthlyTotals(months: readonly string[]): Promise<Record<string, MonthTotals>> {
  const { data, error } = await supabase.from('monthly_summary').select('*').in('month', months);
  if (error) throw error;
  const result: Record<string, MonthTotals> = {};
  for (const m of months) {
    const row = data.find((r) => r.month === m);
    result[m] = { income: row?.income ?? 0, expense: row?.expense ?? 0 };
  }
  return result;
}

export async function fetchCategoryExpense(month: string): Promise<CategoryExpenseRow[]> {
  const { data, error } = await supabase
    .from('category_monthly_expense')
    .select('category_id, amount')
    .eq('month', month);
  if (error) throw error;
  return data;
}

export type Movement = {
  id: string;
  date: string;
  payee: string | null;
  type: Database['public']['Enums']['txn_type'];
  amount: number;
  from_account_id: string | null;
  to_account_id: string | null;
};

/** date より後（未来の日付も含む）の記録。残高の推移を差し戻すのに使う */
export async function fetchMovementsAfter(date: string): Promise<Movement[]> {
  const { data, error } = await supabase
    .from('transactions')
    .select('id, date, type, amount, payee, from_account_id, to_account_id')
    .gt('date', date);
  if (error) throw error;
  return data;
}
