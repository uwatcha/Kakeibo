import { supabase } from '@/lib/supabase';

export type UserSettings = { monthlyLivingCost: number | null };

export async function fetchUserSettings(): Promise<UserSettings> {
  const { data, error } = await supabase.from('user_settings').select('monthly_living_cost').maybeSingle();
  if (error) throw error;
  return { monthlyLivingCost: data?.monthly_living_cost ?? null };
}

/** 1か月の生活費。null なら記録から自動で見積もる */
export async function saveMonthlyLivingCost(value: number | null): Promise<void> {
  const { data: auth } = await supabase.auth.getUser();
  const { error } = await supabase
    .from('user_settings')
    .upsert({ user_id: auth.user!.id, monthly_living_cost: value, updated_at: new Date().toISOString() });
  if (error) throw error;
}

/** 生活費の見積もり用: 直近の確認済みの支払い（定期支払いかどうか付き） */
export async function fetchRecentExpenses(
  since: string,
): Promise<{ date: string; amount: number; recurring: boolean }[]> {
  const { data, error } = await supabase
    .from('transactions')
    .select('date, amount, recurring_rule_id')
    .eq('type', 'expense')
    .eq('is_confirmed', true)
    .gte('date', since);
  if (error) throw error;
  return data.map((t) => ({ date: t.date, amount: t.amount, recurring: t.recurring_rule_id !== null }));
}
