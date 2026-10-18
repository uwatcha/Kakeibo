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
