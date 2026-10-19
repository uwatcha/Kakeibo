import { supabase } from '@/lib/supabase';
import type { Database } from '@/types/database';

import { compareAccounts } from './accountKinds';
import type { AccountBalance } from './summary';

export type Account = Database['public']['Tables']['accounts']['Row'];
export type AccountInsert = Database['public']['Tables']['accounts']['Insert'];
export type AccountUpdate = Database['public']['Tables']['accounts']['Update'];

export async function fetchAccountBalances(): Promise<AccountBalance[]> {
  const { data, error } = await supabase.from('account_balances').select('*');
  if (error) throw error;
  // ビューの列は型の上では nullable だが、accounts の主キーごとに1行なので実際には null にならない
  return data
    .map((row) => ({
      id: row.id!,
      name: row.name!,
      kind: row.kind!,
      isReserved: row.is_reserved!,
      isArchived: row.is_archived!,
      balance: row.balance ?? 0,
      includeInAvailable: row.include_in_available!,
    }))
    .sort(compareAccounts);
}

export async function fetchAccounts(): Promise<Account[]> {
  const { data, error } = await supabase.from('accounts').select('*');
  if (error) throw error;
  return data.sort(compareAccounts);
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

/** 口座の今の残高（account_balances ビューは今日までの記録で計算する） */
export async function fetchAccountBalance(accountId: string): Promise<number> {
  const { data, error } = await supabase.from('account_balances').select('balance').eq('id', accountId).single();
  if (error) throw error;
  return data.balance ?? 0;
}

export type CardSettings = Database['public']['Tables']['credit_card_settings']['Row'];
export type CardSettingsInsert = Database['public']['Tables']['credit_card_settings']['Insert'];

/** クレカの締め日・引き落とし日。未設定なら null */
export async function fetchCardSettings(accountId: string): Promise<CardSettings | null> {
  const { data, error } = await supabase
    .from('credit_card_settings')
    .select('*')
    .eq('account_id', accountId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function saveCardSettings(values: CardSettingsInsert): Promise<void> {
  const { error } = await supabase.from('credit_card_settings').upsert(values);
  if (error) throw error;
}
