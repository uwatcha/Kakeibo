import { FunctionsHttpError } from '@supabase/supabase-js';

import { supabase } from '@/lib/supabase';

export type AiModel = { id: string; label: string; inputTokenLimit: number };
export type AiStatus = { hasKey: boolean; model: string | null; models: AiModel[] };
export type AiMessage = { role: 'user' | 'model'; text: string };
export type AiReply = { text: string; usage: { prompt: number; output: number; total: number }; model: string };

/** AI 相談の失敗。temporary は混み合い・通信の失敗など、少し待てば通るかもしれないもの */
export class AiError extends Error {
  constructor(
    message: string,
    public temporary: boolean,
  ) {
    super(message);
  }
}

/** Gemini の混み合い・一時的な障害の状態コード（Edge Function が status に入れて返す） */
const TEMPORARY_STATUSES = [500, 502, 503, 504];

/** Edge Function ai-chat を呼ぶ。失敗したら関数が返したメッセージで投げる */
async function callAi<T>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke('ai-chat', { body });
  if (error) {
    if (error instanceof FunctionsHttpError) {
      const detail = (await error.context.json().catch(() => null)) as { error?: string; status?: number } | null;
      throw new AiError(
        detail?.error ?? '通信できませんでした',
        detail?.status !== undefined && TEMPORARY_STATUSES.includes(detail.status),
      );
    }
    // 関数まで届かなかった（電波が悪いなど）
    throw new AiError('通信できませんでした', true);
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

export type Conversation = {
  id: string;
  title: string;
  pinned: boolean;
  last_total_tokens: number;
  created_at: string;
  updated_at: string;
  title_generated: boolean;
};
export type StoredMessage = { id: number; role: 'user' | 'model'; shown: string; sent: string };

/** 会話の一覧（ピン留めが先、そのあと新しい順）。先に、期限が過ぎたピン留めなしの会話を消す */
export async function fetchConversations(cutoff: string): Promise<Conversation[]> {
  const purge = await supabase.from('ai_conversations').delete().eq('pinned', false).lt('updated_at', cutoff);
  if (purge.error) throw purge.error;
  const { data, error } = await supabase
    .from('ai_conversations')
    .select('id, title, pinned, last_total_tokens, created_at, updated_at, title_generated')
    .order('pinned', { ascending: false })
    .order('updated_at', { ascending: false });
  if (error) throw error;
  return data;
}

export async function fetchConversation(
  id: string,
): Promise<{ conversation: Conversation; messages: StoredMessage[] }> {
  const [c, m] = await Promise.all([
    supabase
      .from('ai_conversations')
      .select('id, title, pinned, last_total_tokens, created_at, updated_at, title_generated')
      .eq('id', id)
      .single(),
    supabase.from('ai_messages').select('id, role, shown, sent').eq('conversation_id', id).order('id'),
  ]);
  if (c.error) throw c.error;
  if (m.error) throw m.error;
  return { conversation: c.data, messages: m.data as StoredMessage[] };
}

/** 新しい会話を作って id を返す */
export async function createConversation(title: string): Promise<string> {
  const { data, error } = await supabase.from('ai_conversations').insert({ title }).select('id').single();
  if (error) throw error;
  return data.id;
}

/** 質問と返事を保存し、会話の最後のやりとりの時刻と使ったトークンを更新する */
export async function appendExchange(
  conversationId: string,
  question: { shown: string; sent: string },
  answer: { shown: string; sent: string },
  totalTokens: number,
): Promise<void> {
  const inserted = await supabase.from('ai_messages').insert([
    { conversation_id: conversationId, role: 'user', ...question },
    { conversation_id: conversationId, role: 'model', ...answer },
  ]);
  if (inserted.error) throw inserted.error;
  const updated = await supabase
    .from('ai_conversations')
    .update({ updated_at: new Date().toISOString(), last_total_tokens: totalTokens })
    .eq('id', conversationId);
  if (updated.error) throw updated.error;
}

export async function setConversationPinned(id: string, pinned: boolean): Promise<void> {
  const { error } = await supabase.from('ai_conversations').update({ pinned }).eq('id', id);
  if (error) throw error;
}

export async function deleteConversation(id: string): Promise<void> {
  const { error } = await supabase.from('ai_conversations').delete().eq('id', id);
  if (error) throw error;
}

/** 会話（名前を置き換えた文）から、AI に短いタイトルを作ってもらう */
export const generateTitle = (messages: AiMessage[]) => callAi<{ title: string }>({ action: 'title', messages });

export async function saveGeneratedTitle(id: string, title: string): Promise<void> {
  const { error } = await supabase.from('ai_conversations').update({ title, title_generated: true }).eq('id', id);
  if (error) throw error;
}
