import { supabase } from '@/lib/supabase';
import type { Database } from '@/types/database';

export type Category = Database['public']['Tables']['categories']['Row'];

export async function fetchCategories(): Promise<Category[]> {
  const { data, error } = await supabase.from('categories').select('*').order('sort_order').order('created_at');
  if (error) throw error;
  return data;
}

export type CategoryInsert = Database['public']['Tables']['categories']['Insert'];
export type CategoryUpdate = Database['public']['Tables']['categories']['Update'];

export async function createCategory(values: CategoryInsert): Promise<void> {
  const { error } = await supabase.from('categories').insert(values);
  if (error) throw error;
}

export async function updateCategory(id: string, values: CategoryUpdate): Promise<void> {
  const { error } = await supabase.from('categories').update(values).eq('id', id);
  if (error) throw error;
}

/** 同じ階層の中での並び順を振り直す */
export async function reorderCategories(orderedIds: string[]): Promise<void> {
  const results = await Promise.all(
    orderedIds.map((id, index) =>
      supabase
        .from('categories')
        .update({ sort_order: (index + 1) * 10 })
        .eq('id', id),
    ),
  );
  const failed = results.find((r) => r.error);
  if (failed?.error) throw failed.error;
}

/** カテゴリが使われている数（記録・定期支払い・小分類）。どれも 0 なら消せる */
export type CategoryUsage = { transactions: number; rules: number; children: number };

export async function fetchCategoryUsage(id: string): Promise<CategoryUsage> {
  const { data, error } = await supabase.rpc('category_usage', { target: id });
  if (error) throw error;
  return data as CategoryUsage;
}

/** 記録・定期支払い・利用先の対応表・口座の既定のカテゴリを、まとめてほかのカテゴリへ移す。移した記録の件数を返す */
export async function moveCategoryRecords(source: string, destination: string): Promise<number> {
  const { data, error } = await supabase.rpc('move_category_records', { source, destination });
  if (error) throw error;
  return data;
}

/** 使われていないカテゴリを消す（使われていればサーバーが断る） */
export async function deleteUnusedCategory(id: string): Promise<void> {
  const { error } = await supabase.rpc('delete_unused_category', { target: id });
  if (error) throw error;
}
