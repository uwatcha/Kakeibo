import { supabase } from '@/lib/supabase';
import type { Database } from '@/types/database';

export type Employer = Database['public']['Tables']['employers']['Row'];
export type EmployerInsert = Database['public']['Tables']['employers']['Insert'];
export type EmployerUpdate = Database['public']['Tables']['employers']['Update'];

export async function fetchEmployers(): Promise<Employer[]> {
  const { data, error } = await supabase.from('employers').select('*').order('sort_order').order('created_at');
  if (error) throw error;
  return data;
}

export async function createEmployer(values: EmployerInsert): Promise<void> {
  const { error } = await supabase.from('employers').insert(values);
  if (error) throw error;
}

export async function updateEmployer(id: string, values: EmployerUpdate): Promise<void> {
  const { error } = await supabase.from('employers').update(values).eq('id', id);
  if (error) throw error;
}
