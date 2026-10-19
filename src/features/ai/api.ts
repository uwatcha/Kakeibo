import { FunctionsHttpError } from '@supabase/supabase-js';

import { supabase } from '@/lib/supabase';

export type AiModel = { id: string; label: string; inputTokenLimit: number };
export type AiStatus = { hasKey: boolean; model: string | null; models: AiModel[] };
export type AiMessage = { role: 'user' | 'model'; text: string };
export type AiReply = { text: string; usage: { prompt: number; output: number; total: number }; model: string };

/** Edge Function ai-chat を呼ぶ。失敗したら関数が返したメッセージで投げる */
async function callAi<T>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke('ai-chat', { body });
  if (error) {
    let message = '通信できませんでした';
    if (error instanceof FunctionsHttpError) {
      const detail = (await error.context.json().catch(() => null)) as { error?: string } | null;
      if (detail?.error) message = detail.error;
    }
    throw new Error(message);
  }
  return data as T;
}

export const fetchAiStatus = () => callAi<AiStatus>({ action: 'status' });
export const saveAiKey = (key: string) => callAi<AiStatus>({ action: 'save_key', key });
export const deleteAiKey = () => callAi<AiStatus>({ action: 'delete_key' });
export const setAiModel = (model: string) => callAi<{ ok: true }>({ action: 'set_model', model });
export const sendAiChat = (system: string, messages: AiMessage[]) =>
  callAi<AiReply>({ action: 'chat', system, messages });

/** 今日（日本時間）の相談の回数とトークン数 */
export async function fetchAiUsageToday(today: string): Promise<{ count: number; tokens: number }> {
  const { data, error } = await supabase
    .from('ai_usage')
    .select('prompt_tokens, output_tokens')
    .gte('created_at', `${today}T00:00:00+09:00`);
  if (error) throw error;
  return { count: data.length, tokens: data.reduce((sum, r) => sum + r.prompt_tokens + r.output_tokens, 0) };
}
