import { toTokyoDateString } from '@/lib/date';
import { supabase } from '@/lib/supabase';
import type { Database } from '@/types/database';

import { asMovements } from './movements';

export type Movement = {
  id: string;
  date: string;
  payee: string | null;
  type: Database['public']['Enums']['txn_type'];
  amount: number;
  from_account_id: string | null;
  to_account_id: string | null;
  /** 日付は過ぎたが未確認の記録（残高にはまだ入っていない）。予定として明日の日付で扱う */
  overdue?: boolean;
};

/**
 * date より後（未来の日付も含む）の記録と、日付が過ぎた未確認の記録（明日の予定として）。
 * 残高の推移を差し戻したり、予定を足したりするのに使う
 */
export async function fetchMovementsAfter(date: string): Promise<Movement[]> {
  const { data, error } = await supabase
    .from('transactions')
    .select('id, date, type, amount, payee, from_account_id, to_account_id, is_confirmed')
    .or(`date.gt.${date},is_confirmed.eq.false`);
  if (error) throw error;
  return asMovements(data, toTokyoDateString());
}
