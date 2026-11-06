import { FunctionsHttpError } from '@supabase/supabase-js';

import { isConfirmedOnSave } from '@/features/transactions/confirmation';
import { addDays, toTokyoDateString } from '@/lib/date';
import { supabase } from '@/lib/supabase';
import type { Transaction } from '@/features/transactions/api';
import type { Database } from '@/types/database';

import type { EmailSource } from '../../../supabase/functions/_shared/emailParse';
import { notOnStatement, STATEMENT_GRACE_DAYS, STATEMENT_LOOKBACK_DAYS } from './statement';

export type EmailImportSettings = Database['public']['Tables']['email_import_settings']['Row'];
export type EmailImportSource = Database['public']['Tables']['email_import_sources']['Row'];
export type EmailImport = Database['public']['Tables']['email_imports']['Row'];
export type PayeeRule = Database['public']['Tables']['payee_rules']['Row'];

/** Edge Function email-import の URL（Apps Script が送る先） */
export const EMAIL_IMPORT_ENDPOINT = `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/email-import`;

export async function fetchEmailImportSettings(): Promise<EmailImportSettings | null> {
  const { data, error } = await supabase.from('email_import_settings').select('*').maybeSingle();
  if (error) throw error;
  return data;
}

/** 連携の合言葉を作り直す（古い合言葉は使えなくなる）。返すのは合言葉そのもの（保存はハッシュだけ） */
export async function rotateEmailImportToken(): Promise<string> {
  const { data, error } = await supabase.rpc('rotate_email_import_token');
  if (error) throw error;
  return data;
}

export async function saveSummaryRules(rules: string | null): Promise<void> {
  const { error } = await supabase
    .from('email_import_settings')
    .upsert({ summary_rules: rules, updated_at: new Date().toISOString() });
  if (error) throw error;
}

/** ATM の引き出し・預け入れで振り替える現金の口座（null ならいちばん先に作った現金の口座） */
export async function saveAtmCashAccount(accountId: string | null): Promise<void> {
  const { error } = await supabase
    .from('email_import_settings')
    .upsert({ atm_cash_account_id: accountId, updated_at: new Date().toISOString() });
  if (error) throw error;
}

export async function fetchEmailImportSources(): Promise<EmailImportSource[]> {
  const { data, error } = await supabase.from('email_import_sources').select('*');
  if (error) throw error;
  return data;
}

export async function saveEmailImportSource(
  source: EmailSource,
  values: { enabled: boolean; accountId: string | null },
) {
  const { error } = await supabase
    .from('email_import_sources')
    .upsert({ source, enabled: values.enabled, account_id: values.accountId });
  if (error) throw error;
}

export async function fetchPayeeRules(): Promise<PayeeRule[]> {
  const { data, error } = await supabase.from('payee_rules').select('*').order('updated_at', { ascending: false });
  if (error) throw error;
  return data;
}

export async function updatePayeeRule(rawPayee: string, values: { payee: string | null; categoryId: string | null }) {
  const { error } = await supabase
    .from('payee_rules')
    .update({
      payee: values.payee,
      category_id: values.categoryId,
      learned_from: 'user',
      updated_at: new Date().toISOString(),
    })
    .eq('raw_payee', rawPayee);
  if (error) throw error;
}

export async function deletePayeeRule(rawPayee: string) {
  const { error } = await supabase.from('payee_rules').delete().eq('raw_payee', rawPayee);
  if (error) throw error;
}

/** 重複の可能性・AI 待ちの件数と、重複の可能性の一覧（重なった記録も） */
export type OpenImport = EmailImport & {
  duplicate: { payee: string | null; date: string; amount: number } | null;
};

export async function fetchOpenImports(): Promise<OpenImport[]> {
  const { data, error } = await supabase
    .from('email_imports')
    .select('*, duplicate:transactions!email_imports_duplicate_of_fkey(payee, date, amount)')
    .in('status', ['duplicate', 'pending_ai'])
    .order('date', { ascending: false });
  if (error) throw error;
  return data as OpenImport[];
}

/** 重複の可能性を「追加しない」にする */
export async function dismissImport(id: string) {
  const { error } = await supabase.from('email_imports').update({ status: 'dismissed', notified: true }).eq('id', id);
  if (error) throw error;
}

/**
 * 重複の可能性を、それでも記録として追加する。メールはサーバーで内容・カテゴリを決め直して足し、
 * 写真は読み取ったときの内容・口座・カテゴリのまま足す
 */
export async function addDuplicateImport(id: string) {
  const { data: row, error: readError } = await supabase.from('email_imports').select('*').eq('id', id).single();
  if (readError) throw readError;
  if (row.kind === 'photo') {
    if (!row.date || !row.amount || !row.account_id) throw new Error('追加できませんでした');
    const { data: inserted, error } = await supabase
      .from('transactions')
      .insert({
        type: 'expense',
        amount: row.amount,
        date: row.date,
        payee: row.payee,
        category_id: row.category_id,
        from_account_id: row.account_id,
        auto_source: 'photo',
        auto_reviewed: false,
        is_confirmed: isConfirmedOnSave(row.date, toTokyoDateString()),
      })
      .select('id')
      .single();
    if (error) throw error;
    const updated = await supabase
      .from('email_imports')
      .update({ status: 'recorded', transaction_id: inserted.id, notified: true })
      .eq('id', id);
    if (updated.error) throw updated.error;
    return;
  }
  const { error } = await supabase.functions.invoke('email-import', {
    body: { action: 'add_duplicate', importId: id },
  });
  if (error) {
    const detail = error instanceof FunctionsHttpError ? await error.context.json().catch(() => null) : null;
    throw new Error(detail?.error ?? '追加できませんでした');
  }
}

/** 自動で追加して、まだ見ていない記録の id */
export async function markReviewed(ids: readonly string[]) {
  const { error } = await supabase
    .from('transactions')
    .update({ auto_reviewed: true })
    .in('id', [...ids]);
  if (error) throw error;
}

/** 通知していないもの（バックグラウンドで通知する）。記録の内容と金額も */
export async function fetchUnnotified(): Promise<
  (EmailImport & { transaction: { payee: string | null; amount: number; type: string; needs_payee: boolean } | null })[]
> {
  const { data, error } = await supabase
    .from('email_imports')
    .select('*, transaction:transactions!email_imports_transaction_id_fkey(payee, amount, type, needs_payee)')
    .eq('notified', false)
    .neq('status', 'new')
    .neq('status', 'pending_ai')
    .order('created_at')
    .limit(20);
  if (error) throw error;
  return data as never;
}

export async function markNotified(ids: readonly string[]) {
  if (ids.length === 0) return;
  const { error } = await supabase
    .from('email_imports')
    .update({ notified: true })
    .in('id', [...ids]);
  if (error) throw error;
}

/** 自動で追加して、まだ「見た」にしていない記録（新しい順） */
export async function fetchAutoAdded(): Promise<Transaction[]> {
  const { data, error } = await supabase
    .from('transactions')
    .select('*')
    .eq('auto_reviewed', false)
    .order('date', { ascending: false });
  if (error) throw error;
  return data;
}

/** AI が内容（店名）を決められなかった記録（新しい順） */
export async function fetchNeedsPayee(): Promise<Transaction[]> {
  const { data, error } = await supabase
    .from('transactions')
    .select('*')
    .eq('needs_payee', true)
    .order('date', { ascending: false });
  if (error) throw error;
  return data;
}

/**
 * 明細にない記録: メールからの記録で見ている口座への手入力の記録（確認済み・残高調整を除く）で、
 * メールを使い始めた日以降・数日たっても、どのメールとも結び付いていないもの（新しい順）
 */
export async function fetchNotOnStatement(): Promise<Transaction[]> {
  const [settings, sources] = await Promise.all([fetchEmailImportSettings(), fetchEmailImportSources()]);
  const watched = sources
    .filter((s): s is EmailImportSource & { account_id: string } => s.enabled && !!s.account_id)
    .map((s) => ({ source: s.source as EmailSource, accountId: s.account_id }));
  if (!settings?.started_at || watched.length === 0) return [];
  const today = toTokyoDateString();
  const started = toTokyoDateString(new Date(settings.started_at));
  const lookback = addDays(today, -STATEMENT_LOOKBACK_DAYS);
  const from = started > lookback ? started : lookback;
  const through = addDays(today, -STATEMENT_GRACE_DAYS);
  if (from > through) return [];
  const ids = [...new Set(watched.map((w) => w.accountId))].join(',');
  const { data, error } = await supabase
    .from('transactions')
    .select('*')
    .is('auto_source', null)
    .eq('is_confirmed', true)
    .eq('statement_checked', false)
    .neq('type', 'adjustment')
    // 支払いの内訳から分けた立て替えは、メールでは元の支払いと合わせた1件で来るので見ない
    .is('split_from_id', null)
    .gte('date', from)
    .lte('date', through)
    .or(`from_account_id.in.(${ids}),to_account_id.in.(${ids})`)
    .order('date', { ascending: false });
  if (error) throw error;
  if (data.length === 0) return [];
  // 重複として見送ったメール（duplicate_of）・予定を確認したメール（transaction_id）が指す記録
  const { data: imports, error: importError } = await supabase
    .from('email_imports')
    .select('duplicate_of, transaction_id')
    .gte('date', addDays(from, -STATEMENT_GRACE_DAYS));
  if (importError) throw importError;
  const matched = new Set(imports.flatMap((i) => [i.duplicate_of, i.transaction_id]).filter((id): id is string => !!id));
  return notOnStatement(data, watched, matched);
}

/** 明細にない記録を、確かめた（明細にあった・そのままでよい）にする */
export async function markStatementChecked(ids: string[]): Promise<void> {
  const { error } = await supabase.from('transactions').update({ statement_checked: true }).in('id', ids);
  if (error) throw error;
}
