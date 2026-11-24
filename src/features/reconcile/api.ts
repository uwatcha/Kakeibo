import { supabase } from '@/lib/supabase';

import type { ReconcileRecord } from './match';

/** 口座が関わる記録（残高調整を除く）を、その口座から見た向きで読む */
export async function fetchAccountRecordsBetween(
  accountId: string,
  from: string,
  to: string,
): Promise<ReconcileRecord[]> {
  const { data, error } = await supabase
    .from('transactions')
    .select('id, date, type, amount, list_price, payee, from_account_id, to_account_id, is_confirmed')
    .or(`from_account_id.eq.${accountId},to_account_id.eq.${accountId}`)
    .neq('type', 'adjustment')
    .gte('date', from)
    .lte('date', to)
    .order('date');
  if (error) throw error;
  return data.map((t) => ({
    id: t.id,
    date: t.date,
    direction: t.from_account_id === accountId ? 'out' : 'in',
    amount: t.amount,
    listPrice: t.list_price,
    payee: t.payee,
    type: t.type,
    isConfirmed: t.is_confirmed,
  }));
}
