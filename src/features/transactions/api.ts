import { addMonths } from '@/lib/date';
import { supabase } from '@/lib/supabase';
import type { Database } from '@/types/database';

export type Transaction = Database['public']['Tables']['transactions']['Row'];
export type TransactionInsert = Database['public']['Tables']['transactions']['Insert'];
export type TransactionUpdate = Database['public']['Tables']['transactions']['Update'];

/** month は月初（YYYY-MM-01）。新しい日付・新しく入れた順 */
export async function fetchMonthTransactions(month: string): Promise<Transaction[]> {
  const { data, error } = await supabase
    .from('transactions')
    .select('*')
    .gte('date', month)
    .lt('date', addMonths(month, 1))
    .order('date', { ascending: false })
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data;
}

/** その口座から出た・入った記録（新しい順）。口座の利用履歴用 */
export async function fetchAccountTransactions(accountId: string): Promise<Transaction[]> {
  const { data, error } = await supabase
    .from('transactions')
    .select('*')
    .or(`from_account_id.eq.${accountId},to_account_id.eq.${accountId}`)
    .order('date', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(1000);
  if (error) throw error;
  return data;
}

export async function fetchTransaction(id: string): Promise<Transaction> {
  const { data, error } = await supabase.from('transactions').select('*').eq('id', id).single();
  if (error) throw error;
  return data;
}

export async function createTransaction(values: TransactionInsert): Promise<void> {
  const { error } = await supabase.from('transactions').insert(values);
  if (error) throw error;
}

export async function updateTransaction(id: string, values: TransactionUpdate): Promise<void> {
  const { error } = await supabase.from('transactions').update(values).eq('id', id);
  if (error) throw error;
}

export async function deleteTransaction(id: string): Promise<void> {
  const { error } = await supabase.from('transactions').delete().eq('id', id);
  if (error) throw error;
}

/** 全期間から検索する（新しい順に最大200件）。filter は buildSearchFilter で作る */
export async function searchTransactions(filter: string): Promise<Transaction[]> {
  const { data, error } = await supabase
    .from('transactions')
    .select('*')
    .or(filter)
    .order('date', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(200);
  if (error) throw error;
  return data;
}

/** 同じ日・同じ金額の記録（重複入力の確認用）。excludeId は編集中の記録 */
export async function findSameDayAmount(date: string, amount: number, excludeId?: string): Promise<Transaction[]> {
  let query = supabase.from('transactions').select('*').eq('date', date).eq('amount', amount).limit(5);
  if (excludeId) query = query.neq('id', excludeId);
  const { data, error } = await query;
  if (error) throw error;
  return data;
}

/** これまでの記録の内容（新しい順に最大1000件）。内容の入力候補用 */
export async function fetchPayeeHistory(): Promise<string[]> {
  const { data, error } = await supabase
    .from('transactions')
    .select('payee')
    .not('payee', 'is', null)
    .order('date', { ascending: false })
    .limit(1000);
  if (error) throw error;
  return data.map((row) => row.payee!).filter((payee) => payee.trim() !== '');
}

/** 同じ内容・同じ種類で過去に付けたカテゴリ（新しい順に最大20件）。カテゴリの予測用（REQ-8） */
export async function fetchCategoryHistory(
  payee: string,
  type: Transaction['type'],
): Promise<{ category_id: string | null }[]> {
  const { data, error } = await supabase
    .from('transactions')
    .select('category_id')
    .eq('payee', payee)
    .eq('type', type)
    .not('category_id', 'is', null)
    .order('date', { ascending: false })
    .limit(20);
  if (error) throw error;
  return data;
}
