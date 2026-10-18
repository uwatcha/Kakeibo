import { addDays } from '@/lib/date';
import { supabase } from '@/lib/supabase';
import type { Database } from '@/types/database';

import { occurrencesBetween } from './schedule';

export type RecurringRule = Database['public']['Tables']['recurring_rules']['Row'];
export type RecurringRuleInsert = Database['public']['Tables']['recurring_rules']['Insert'];
export type RecurringRuleUpdate = Database['public']['Tables']['recurring_rules']['Update'];
type Transaction = Database['public']['Tables']['transactions']['Row'];

/** 何日先の回まで記録を作っておくか（予定として一覧に出す。残高にはその日まで入らない） */
export const GENERATE_AHEAD_DAYS = 31;

export async function fetchRules(): Promise<RecurringRule[]> {
  const { data, error } = await supabase.from('recurring_rules').select('*').order('sort_order').order('created_at');
  if (error) throw error;
  return data;
}

/** そのルールで追加した記録（新しい順） */
export async function fetchGeneratedTransactions(ruleId: string): Promise<Transaction[]> {
  const { data, error } = await supabase
    .from('transactions')
    .select('*')
    .eq('recurring_rule_id', ruleId)
    .order('date', { ascending: false });
  if (error) throw error;
  return data;
}

/** ルールの回のうち、まだ追加していない分を記録にする。追加した件数を返す */
async function generateForRule(rule: RecurringRule, today: string): Promise<number> {
  const until = addDays(today, GENERATE_AHEAD_DAYS);
  const dates = occurrencesBetween(rule, rule.generated_until, until);
  if (dates.length > 0) {
    const { error } = await supabase.from('transactions').upsert(
      dates.map((date) => ({
        type: rule.type,
        amount: rule.amount,
        from_account_id: rule.from_account_id,
        to_account_id: rule.to_account_id,
        category_id: rule.category_id,
        date,
        payee: rule.name,
        recurring_rule_id: rule.id,
      })),
      { onConflict: 'recurring_rule_id,date', ignoreDuplicates: true },
    );
    if (error) throw error;
  }
  // 消した記録を作り直さないよう、どこまで追加したかを残す
  const { error } = await supabase.from('recurring_rules').update({ generated_until: until }).eq('id', rule.id);
  if (error) throw error;
  return dates.length;
}

/** 動いているルールすべてについて、期日の来た回（と少し先の回）を記録にする */
export async function generateDueTransactions(today: string): Promise<number> {
  const rules = (await fetchRules()).filter((r) => r.is_active);
  let total = 0;
  for (const rule of rules) total += await generateForRule(rule, today);
  return total;
}

export async function createRule(values: RecurringRuleInsert): Promise<void> {
  const { error } = await supabase.from('recurring_rules').insert(values);
  if (error) throw error;
}

/**
 * ルールを変える。金額や日付が変わると先の予定が合わなくなるので、
 * 今日より後の日付で追加済みの記録を消し、今日の次の回から作り直す。
 */
export async function updateRule(id: string, values: RecurringRuleUpdate, today: string): Promise<void> {
  const { error: deleteError } = await supabase
    .from('transactions')
    .delete()
    .eq('recurring_rule_id', id)
    .gt('date', today);
  if (deleteError) throw deleteError;

  const { data: current, error: fetchError } = await supabase
    .from('recurring_rules')
    .select('generated_until')
    .eq('id', id)
    .single();
  if (fetchError) throw fetchError;
  // 追加済みの位置は今日までに戻す（まだ一度も追加していなければそのまま）
  const generatedUntil = current.generated_until && current.generated_until > today ? today : current.generated_until;

  const { error } = await supabase
    .from('recurring_rules')
    .update({ ...values, generated_until: generatedUntil })
    .eq('id', id);
  if (error) throw error;
}

/** 止めていたルールを動かすときは、止めていた間の回をさかのぼって作らない */
export async function setRuleActive(id: string, isActive: boolean, today: string): Promise<void> {
  const update: RecurringRuleUpdate = { is_active: isActive };
  if (isActive) {
    const { data, error } = await supabase.from('recurring_rules').select('generated_until').eq('id', id).single();
    if (error) throw error;
    if (data.generated_until && data.generated_until < today) update.generated_until = addDays(today, -1);
  }
  const { error } = await supabase.from('recurring_rules').update(update).eq('id', id);
  if (error) throw error;
}

/** ルールで追加した記録をまとめて消す（間違えて登録したとき用）。ルール自体は残す */
export async function deleteGeneratedTransactions(ruleId: string): Promise<void> {
  const { error } = await supabase.from('transactions').delete().eq('recurring_rule_id', ruleId);
  if (error) throw error;
}

/** ルールを消す。追加済みの記録は残り、ルールへの参照だけが外れる */
export async function deleteRule(id: string): Promise<void> {
  const { error } = await supabase.from('recurring_rules').delete().eq('id', id);
  if (error) throw error;
}
