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
