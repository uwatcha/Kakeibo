import { SALARY_CATEGORY } from '@/features/transactions/salary';
import { supabase } from '@/lib/supabase';

import type { Employer } from './api';
import { monthsLater, pendingSalaryDates, SALARY_AHEAD_MONTHS } from './salarySchedule';

/** 目安と入金先が入っていて、非表示でない働き先だけ予定を入れる */
const canPlan = (e: Employer) => !e.is_archived && !!e.salary_amount && !!e.salary_account_id;

async function salaryCategoryId(): Promise<string | null> {
  const { data, error } = await supabase
    .from('categories')
    .select('id')
    .eq('kind', 'income')
    .eq('name', SALARY_CATEGORY)
    .is('parent_id', null)
    .limit(1);
  if (error) throw error;
  return data[0]?.id ?? null;
}

/** 1つの働き先の、まだ入れていない給料日の予定を入れる。手で入れた給料（同じ日・同じ働き先の収入）がある日は入れない */
async function planFor(employer: Employer, today: string, categoryId: string | null): Promise<number> {
  const through = monthsLater(today, SALARY_AHEAD_MONTHS);
  const dates = pendingSalaryDates(employer, today);
  let added = 0;
  if (dates.length > 0) {
    const existing = await supabase
      .from('transactions')
      .select('date')
      .eq('type', 'income')
      .eq('employer_id', employer.id)
      .in('date', dates);
    if (existing.error) throw existing.error;
    const taken = new Set(existing.data.map((t) => t.date));
    const rows = dates
      .filter((date) => !taken.has(date))
      .map((date) => ({
        type: 'income' as const,
        amount: employer.salary_amount!,
        to_account_id: employer.salary_account_id!,
        category_id: categoryId,
        employer_id: employer.id,
        payee: employer.name,
        date,
        // 実際の額で確かめてもらうため、日付が来たら「未確認」になる
        is_confirmed: false,
        auto_salary: true,
      }));
    if (rows.length > 0) {
      const { error } = await supabase.from('transactions').insert(rows);
      if (error) throw error;
      added = rows.length;
    }
  }
  // 消した予定を作り直さないよう、どこまで入れたかを残す
  const { error } = await supabase.from('employers').update({ salary_generated_until: through }).eq('id', employer.id);
  if (error) throw error;
  return added;
}

/** すべての働き先について、2か月先までの給料の予定を入れる。入れた件数を返す */
export async function generateSalaryPlans(today: string): Promise<number> {
  const { data, error } = await supabase.from('employers').select('*');
  if (error) throw error;
  const targets = data.filter(canPlan);
  if (targets.length === 0) return 0;
  const categoryId = await salaryCategoryId();
  let added = 0;
  for (const employer of targets) added += await planFor(employer, today, categoryId);
  return added;
}

/** 目安・入金先・給料日を変えたとき: 今日より後の自動の予定を消して、入れ直す */
export async function replanSalary(employerId: string, today: string): Promise<void> {
  const removed = await supabase
    .from('transactions')
    .delete()
    .eq('employer_id', employerId)
    .eq('auto_salary', true)
    .gt('date', today);
  if (removed.error) throw removed.error;
  const { data, error } = await supabase
    .from('employers')
    .update({ salary_generated_until: today })
    .eq('id', employerId)
    .select('*')
    .single();
  if (error) throw error;
  if (canPlan(data)) await planFor(data, today, await salaryCategoryId());
}
