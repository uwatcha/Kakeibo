import { FunctionsHttpError, FunctionsRelayError } from '@supabase/supabase-js';

import { supabase } from '@/lib/supabase';

export type AiModel = { id: string; label: string; inputTokenLimit: number };
export type AiStatus = {
  /** Gemini か Claude のどちらかのキーがある */
  hasKey: boolean;
  gemini: boolean;
  claude: boolean;
  /** Claude のキーの期限（保存してから30日）。キーがなければ null */
  claudeExpiresAt: string | null;
  model: string | null;
  models: AiModel[];
};
export type AiProvider = 'gemini' | 'claude';
export type AiMessage = { role: 'user' | 'model'; text: string; files?: { mimeType: string; data: string }[] };
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

/** 混み合い・一時的な障害の状態コード（Edge Function が status に入れて返す。Claude の 529 も 503 にして返す） */
const TEMPORARY_STATUSES = [500, 502, 503, 504];

/** 関数が文を返せなかったとき（時間切れなど）の、HTTP の状態コードごとの文 */
function statusMessage(status: number): AiError {
  if (status === 401)
    return new AiError('ログインの期限が切れました。アプリを開き直すか、ログインし直してください', false);
  if (status === 504 || status === 546) {
    return new AiError('AI の返事を待つ時間の上限を過ぎました。質問を短くするか、分けて送ってください', false);
  }
  if (status === 413) return new AiError('送る内容が大きすぎます。添付を減らすか小さくしてください', false);
  return new AiError(
    `サーバーで処理できませんでした（${status}）。少し待ってから送り直してください`,
    TEMPORARY_STATUSES.includes(status),
  );
}

/** Edge Function ai-chat を呼ぶ。失敗したら、何が起きたか・どうすればよいかの文で投げる（文は関数の aiErrors.ts が作る） */
async function callAi<T>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke('ai-chat', { body });
  if (error) {
    if (error instanceof FunctionsHttpError) {
      const response = error.context as Response;
      const detail = (await response.json().catch(() => null)) as { error?: string; status?: number } | null;
      if (!detail?.error) throw statusMessage(response.status);
      throw new AiError(detail.error, detail.status !== undefined && TEMPORARY_STATUSES.includes(detail.status));
    }
    if (error instanceof FunctionsRelayError) {
      throw new AiError('サーバー（Supabase）が一時的に応答していません。少し待ってから送り直してください', true);
    }
    // 関数まで届かなかった（電波が悪い・機内モードなど）
    throw new AiError('インターネットにつながりませんでした。電波の良い所で、もう一度送ってください', true);
  }
  return data as T;
}

export const fetchAiStatus = () => callAi<AiStatus>({ action: 'status' });
export const saveAiKey = ({ provider, key }: { provider: AiProvider; key: string }) =>
  callAi<AiStatus>({ action: 'save_key', provider, key });
export const deleteAiKey = (provider: AiProvider) => callAi<AiStatus>({ action: 'delete_key', provider });
export const setAiModel = (model: string) => callAi<{ ok: true }>({ action: 'set_model', model });
/** strong: 難しい質問（strongModel.ts）。Claude のキーがあれば強いモデルで答える */
export const sendAiChat = (system: string, messages: AiMessage[], strong = false) =>
  callAi<AiReply>({ action: 'chat', system, messages, strong });

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
  title_generated_at: string | null;
};
export type StoredMessage = {
  id: number;
  role: 'user' | 'model';
  shown: string;
  sent: string;
  images: string[] | null;
};
/** 質問（画像は横幅 1024px の JPEG の base64） */
export type Question = { shown: string; sent: string; images?: string[] };

/** 会話の一覧（ピン留めが先、そのあと新しい順）。先に、期限が過ぎたピン留めなしの会話を消す */
export async function fetchConversations(cutoff: string): Promise<Conversation[]> {
  const purge = await supabase.from('ai_conversations').delete().eq('pinned', false).lt('updated_at', cutoff);
  if (purge.error) throw purge.error;
  const { data, error } = await supabase
    .from('ai_conversations')
    .select('id, title, pinned, last_total_tokens, created_at, updated_at, title_generated_at')
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
      .select('id, title, pinned, last_total_tokens, created_at, updated_at, title_generated_at')
      .eq('id', id)
      .single(),
    supabase.from('ai_messages').select('id, role, shown, sent, images').eq('conversation_id', id).order('id'),
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
  question: Question,
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

/**
 * 会話（名前を置き換えた文）から、AI に短いタイトルを作ってもらう。
 * currentTitle（置き換え後）を渡すと、話題が大きく変わっていなければそのまま返ってくる
 */
export const generateTitle = (messages: AiMessage[], currentTitle?: string) =>
  callAi<{ title: string }>({ action: 'title', messages, currentTitle });

export async function saveGeneratedTitle(id: string, title: string): Promise<void> {
  const { error } = await supabase
    .from('ai_conversations')
    .update({ title, title_generated_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw error;
}

/** 写真・ファイル（base64）やテキストから記録を読み取ってもらう（AI入力）。records は JSON の配列（features/ai/extract.ts で確かめる） */
export const extractRecords = (system: string, text: string, files: { mimeType: string; data: string }[]) =>
  callAi<{ records: unknown }>({ action: 'extract', system, text, files });
