import { supabase } from '@/lib/supabase';
import type { Database } from '@/types/database';

import type { AccountBalance } from './summary';

export type Account = Database['public']['Tables']['accounts']['Row'];
export type AccountInsert = Database['public']['Tables']['accounts']['Insert'];
export type AccountUpdate = Database['public']['Tables']['accounts']['Update'];

export async function fetchAccountBalances(): Promise<AccountBalance[]> {
  const { data, error } = await supabase.from('account_balances').select('*');
  if (error) throw error;
  // ビューの列は型の上では nullable だが、accounts の主キーごとに1行なので実際には null にならない
  return data.map((row) => ({
    id: row.id!,
    name: row.name!,
    kind: row.kind!,
    isReserved: row.is_reserved!,
    isArchived: row.is_archived!,
    sortOrder: row.sort_order!,
    balance: row.balance ?? 0,
  }));
}

export async function fetchAccounts(): Promise<Account[]> {
  const { data, error } = await supabase.from('accounts').select('*').order('sort_order').order('created_at');
  if (error) throw error;
  return data;
}

export async function fetchAccount(id: string): Promise<Account> {
  const { data, error } = await supabase.from('accounts').select('*').eq('id', id).single();
  if (error) throw error;
  return data;
}

export async function createAccount(values: AccountInsert): Promise<void> {
  const { error } = await supabase.from('accounts').insert(values);
  if (error) throw error;
}

export async function updateAccount(id: string, values: AccountUpdate): Promise<void> {
  const { error } = await supabase.from('accounts').update(values).eq('id', id);
  if (error) throw error;
}

/** 並べ替え後の順番どおりに sort_order を振り直す */
export async function reorderAccounts(orderedIds: string[]): Promise<void> {
  const results = await Promise.all(
    orderedIds.map((id, index) =>
      supabase
        .from('accounts')
        .update({ sort_order: (index + 1) * 10 })
        .eq('id', id),
    ),
  );
  const failed = results.find((r) => r.error);
  if (failed?.error) throw failed.error;
}

/** 口座の今日の終わり時点の残高（未来の日付の記録は含めない） */
export async function fetchBalanceAsOf(accountId: string, date: string): Promise<number> {
  const [balance, future] = await Promise.all([
    supabase.from('account_balances').select('balance').eq('id', accountId).single(),
    supabase
      .from('transactions')
      .select('amount, from_account_id, to_account_id')
      .gt('date', date)
      .or(`from_account_id.eq.${accountId},to_account_id.eq.${accountId}`),
  ]);
  if (balance.error) throw balance.error;
  if (future.error) throw future.error;
  const futureEffect = future.data.reduce(
    (sum, t) => sum + (t.to_account_id === accountId ? t.amount : 0) - (t.from_account_id === accountId ? t.amount : 0),
    0,
  );
  return (balance.data.balance ?? 0) - futureEffect;
}
