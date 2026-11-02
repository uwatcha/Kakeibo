import { addDays, addMonths } from '@/lib/date';
import { supabase } from '@/lib/supabase';
import type { Database } from '@/types/database';

import { type SearchFilters, sourceFilter } from './search';
import type { TransactionItem } from './items';

/** 記録。items は内訳（読み込んだときだけ入る。fetchMonthTransactions・fetchTransaction） */
export type Transaction = Database['public']['Tables']['transactions']['Row'] & { items?: TransactionItem[] };
export type TransactionInsert = Database['public']['Tables']['transactions']['Insert'];
export type TransactionUpdate = Database['public']['Tables']['transactions']['Update'];

/** 記録と内訳（並び順どおり）を読むときの select */
const WITH_ITEMS = '*, items:transaction_items(category_id, name, amount, is_adjustment, sort_order)';

/** 内訳を並び順どおりにする */
function sortItems<T extends { items?: unknown }>(t: T): T {
  const items = t.items as (TransactionItem & { sort_order?: number })[] | undefined;
  if (!items) return t;
  return { ...t, items: [...items].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)) };
}

/** month は月初（YYYY-MM-01）。新しい日付・新しく入れた順 */
export async function fetchMonthTransactions(month: string): Promise<Transaction[]> {
  const { data, error } = await supabase
    .from('transactions')
    .select(WITH_ITEMS)
    .gte('date', month)
    .lt('date', addMonths(month, 1))
    .order('date', { ascending: false })
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data as Transaction[]).map(sortItems);
}

/** その口座から出た・入った記録（新しい順）。口座の利用履歴用 */
export async function fetchAccountTransactions(accountId: string): Promise<Transaction[]> {
  const { data, error } = await supabase
    .from('transactions')
    .select('*')
    .or(`from_account_id.eq.${accountId},to_account_id.eq.${accountId}`)
    .order('date', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(1000);
  if (error) throw error;
  return data;
}

/** date 以降の記録（未来の日付も含む。新しい順）。AI の家計相談の材料用 */
export async function fetchTransactionsSince(date: string): Promise<Transaction[]> {
  const { data, error } = await supabase
    .from('transactions')
    .select('*')
    .gte('date', date)
    .order('date', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(2000);
  if (error) throw error;
  return data;
}

/** from〜to（両端を含む）の記録の日付・金額・メールから自動で入ったか（AI入力で重複を確かめる） */
export async function fetchDateAmountsBetween(
  from: string,
  to: string,
): Promise<{ id: string; date: string; amount: number; auto_source: string | null }[]> {
  const { data, error } = await supabase
    .from('transactions')
    .select('id, date, amount, auto_source')
    .gte('date', from)
    .lte('date', to);
  if (error) throw error;
  return data;
}

/** date の前後 days 日の支払い（立て替えの「元の支払い」を選ぶ候補。新しい順） */
/**
 * 立て替えと、それを返してもらった貸し金戻り（2026-10-24 改善要望で、つなぐ先を元の支払いから貸し金戻りに変更）。
 * 立て替えの related_transaction_id が貸し金戻りを指す。1回の貸し金戻りで、いくつもの立て替えを返してもらえる
 */
/** その相手からの貸し金戻り（since の日から。古い順） */
export async function fetchCollectsFrom(personId: string, since: string): Promise<Transaction[]> {
  const { data, error } = await supabase
    .from('transactions')
    .select('*')
    .eq('type', 'collect')
    .eq('from_account_id', personId)
    .gte('date', since)
    .order('date')
    .limit(50);
  if (error) throw error;
  return data;
}

/** その相手への立て替え（新しい順） */
export async function fetchAdvancesTo(personId: string): Promise<Transaction[]> {
  const { data, error } = await supabase
    .from('transactions')
    .select('*')
    .eq('type', 'advance')
    .eq('to_account_id', personId)
    .order('date', { ascending: false })
    .limit(50);
  if (error) throw error;
  return data;
}

/** その貸し金戻りで返してもらった立て替え */
export async function fetchAdvancesFor(collectId: string): Promise<Transaction[]> {
  const { data, error } = await supabase
    .from('transactions')
    .select('*')
    .eq('related_transaction_id', collectId)
    .order('date');
  if (error) throw error;
  return data;
}

/** 貸し金戻りで返してもらった立て替えを advanceIds にする（外したものはつながりを消す） */
export async function setAdvancesRepaidBy(collectId: string, advanceIds: readonly string[]): Promise<void> {
  const unlink = supabase.from('transactions').update({ related_transaction_id: null }).eq('related_transaction_id', collectId);
  const { error } = await (advanceIds.length > 0 ? unlink.not('id', 'in', `(${advanceIds.join(',')})`) : unlink);
  if (error) throw error;
  if (advanceIds.length === 0) return;
  const { error: linkError } = await supabase
    .from('transactions')
    .update({ related_transaction_id: collectId })
    .in('id', [...advanceIds])
    .eq('type', 'advance');
  if (linkError) throw linkError;
}

/** 日付が過ぎたのに未確認の記録（古い順）。確認するまで残高・集計に入らない */
export async function fetchUnconfirmed(today: string): Promise<Transaction[]> {
  const { data, error } = await supabase
    .from('transactions')
    .select('*')
    .eq('is_confirmed', false)
    .lte('date', today)
    .order('date')
    .order('created_at');
  if (error) throw error;
  return data;
}

/** まとめて確認済みにする */
export async function confirmTransactions(ids: readonly string[]): Promise<void> {
  const { error } = await supabase.from('transactions').update({ is_confirmed: true }).in('id', ids);
  if (error) throw error;
}

export async function fetchTransaction(id: string): Promise<Transaction> {
  const { data, error } = await supabase.from('transactions').select(WITH_ITEMS).eq('id', id).single();
  if (error) throw error;
  return sortItems(data as Transaction);
}

/** 記録を1件足し、その id を返す */
export async function createTransaction(values: TransactionInsert): Promise<string> {
  const { data, error } = await supabase.from('transactions').insert(values).select('id').single();
  if (error) throw error;
  return data.id;
}

/** まとめて追加する（AI入力） */
export async function createTransactions(rows: (TransactionInsert & { items?: TransactionItem[] })[]): Promise<void> {
  if (rows.length === 0) return;
  const { data, error } = await supabase
    .from('transactions')
    .insert(rows.map(({ items: _items, ...row }) => row))
    .select('id');
  if (error) throw error;
  // 内訳があれば、足した記録に付ける（insert は渡した順に返る）
  for (const [i, row] of rows.entries()) {
    if (row.items?.length) await saveTransactionItems(data[i].id, row.items);
  }
}

/** 記録の内訳を入れ直す（今ある内訳を消して items を入れる。空なら内訳なし） */
export async function saveTransactionItems(transactionId: string, items: readonly TransactionItem[]): Promise<void> {
  const { error } = await supabase.from('transaction_items').delete().eq('transaction_id', transactionId);
  if (error) throw error;
  if (items.length === 0) return;
  const { error: insertError } = await supabase
    .from('transaction_items')
    .insert(items.map((item, sort_order) => ({ ...item, transaction_id: transactionId, sort_order })));
  if (insertError) throw insertError;
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
/**
 * 記録を探す: text は言葉の検索（buildSearchFilter。内容・メモ・カテゴリ・金額のどれか）、filters は項目ごとの絞り込み
 * （すべてに当てはまるもの）。categoryIds は小分類を足したもの（expandCategoryIds）を渡す
 */
export async function searchTransactions(text: string | null, filters: SearchFilters): Promise<Transaction[]> {
  let query = supabase.from('transactions').select('*');
  // 「〜か〜」の条件（言葉・口座・入力元）は、1つの式にまとめてすべて満たすもの（and）にする
  const anyOf = [
    text,
    filters.accountIds.length > 0
      ? `from_account_id.in.(${filters.accountIds.join(',')}),to_account_id.in.(${filters.accountIds.join(',')})`
      : null,
    sourceFilter(filters.sources),
  ].filter((g): g is string => !!g);
  if (anyOf.length === 1) query = query.or(anyOf[0]);
  if (anyOf.length > 1) query = query.or(`and(${anyOf.map((g) => `or(${g})`).join(',')})`);
  if (filters.types.length > 0) query = query.in('type', filters.types as Transaction['type'][]);
  if (filters.categoryIds.length > 0) query = query.in('category_id', filters.categoryIds);
  if (filters.from) query = query.gte('date', filters.from);
  if (filters.to) query = query.lte('date', filters.to);
  if (filters.amountMin !== null) query = query.gte('amount', filters.amountMin);
  if (filters.amountMax !== null) query = query.lte('amount', filters.amountMax);
  const { data, error } = await query
    .order('date', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(300);
  if (error) throw error;
  return data;
}

/** 同じ日・同じ金額の記録（重複入力の確認用）。excludeId は編集中の記録 */
/** 同じ金額で、date の前後 days 日の記録（重複の可能性をすべて見るため。日付順） */
export async function fetchSameAmountAround(date: string, amount: number, days: number): Promise<Transaction[]> {
  const { data, error } = await supabase
    .from('transactions')
    .select('*')
    .eq('amount', amount)
    .gte('date', addDays(date, -days))
    .lte('date', addDays(date, days))
    .order('date')
    .limit(20);
  if (error) throw error;
  return data;
}

export async function findSameDayAmount(date: string, amount: number, excludeId?: string): Promise<Transaction[]> {
  let query = supabase.from('transactions').select('*').eq('date', date).eq('amount', amount).limit(5);
  if (excludeId) query = query.neq('id', excludeId);
  const { data, error } = await query;
  if (error) throw error;
  return data;
}

/** これまでの記録の内容（新しい順に最大1000件）。内容の入力候補用 */
export async function fetchPayeeHistory(): Promise<string[]> {
  const { data, error } = await supabase
    .from('transactions')
    .select('payee')
    .not('payee', 'is', null)
    .order('date', { ascending: false })
    .limit(1000);
  if (error) throw error;
  return data.map((row) => row.payee!).filter((payee) => payee.trim() !== '');
}

/** 同じ内容・同じ種類で過去に付けたカテゴリ（新しい順に最大20件）。カテゴリの予測用（REQ-8） */
export async function fetchCategoryHistory(
  payee: string,
  type: Transaction['type'],
): Promise<{ category_id: string | null }[]> {
  const { data, error } = await supabase
    .from('transactions')
    .select('category_id')
    .eq('payee', payee)
    .eq('type', type)
    .not('category_id', 'is', null)
    .order('date', { ascending: false })
    .limit(20);
  if (error) throw error;
  return data;
}
