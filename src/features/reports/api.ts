import { supabase } from '@/lib/supabase';
import type { Database } from '@/types/database';

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
