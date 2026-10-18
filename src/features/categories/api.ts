import { supabase } from '@/lib/supabase';
import type { Database } from '@/types/database';

export type Category = Database['public']['Tables']['categories']['Row'];

export async function fetchCategories(): Promise<Category[]> {
  const { data, error } = await supabase.from('categories').select('*').order('sort_order').order('created_at');
  if (error) throw error;
  return data;
}
