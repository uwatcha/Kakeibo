import AsyncStorage from '@react-native-async-storage/async-storage';

import { restoreText } from './anonymize';
import { AiError, type AiMessage, appendExchange, createConversation, sendAiChat } from './api';
import { titleFrom } from './retention';

/**
 * 混み合いで送れなかった AI 相談の質問。アプリを閉じても送り直せるよう、端末（AsyncStorage）に置く。
 * 送る材料（system・messages）は名前を置き換えた後のもの。返事を元の名前に戻すための対応表も持つ
 */
export type PendingSend = {
  id: string;
  /** 続きを送る会話。新しいチャットなら null（送れたら会話を作る） */
  conversationId: string | null;
  question: { shown: string; sent: string };
  system: string;
  messages: AiMessage[];
  /** 置き換え後 → 元の名前 */
  toReal: [string, string][];
  createdAt: number;
};

/** これより長く送れなければあきらめる */
const GIVE_UP_MS = 24 * 60 * 60 * 1000;
const STORAGE_KEY = 'kakeibo:pendingAiSends';

export async function loadPending(): Promise<PendingSend[]> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as PendingSend[]) : [];
  } catch {
    return [];
  }
}

async function savePending(list: PendingSend[]): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(list));
}

/** 送り直し待ちに足し、その id を返す */
export async function addPending(item: Omit<PendingSend, 'id' | 'createdAt'>): Promise<string> {
  const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const list = await loadPending();
  await savePending([...list, { ...item, id, createdAt: Date.now() }]);
  return id;
}

/** 送り直し待ちから外す。外せたら true（ほかの所ですでに送り終えていたら false） */
export async function takePending(id: string): Promise<boolean> {
  const list = await loadPending();
  if (!list.some((p) => p.id === id)) return false;
  await savePending(list.filter((p) => p.id !== id));
  return true;
}

export type SendOutcome =
  { kind: 'sent'; conversationId: string; preview: string } | { kind: 'failed'; message: string } | { kind: 'waiting' };

/** 1件を送ってみる。送れたら質問と返事を保存する（新しいチャットなら会話を作る） */
export async function trySend(item: PendingSend, now: number): Promise<SendOutcome> {
  try {
    const reply = await sendAiChat(item.system, item.messages);
    // 画面の送り直しと同時に送れていたら、二重に保存しない
    if (!(await takePending(item.id))) return { kind: 'waiting' };
    const shown = restoreText(reply.text, { toReal: new Map(item.toReal) });
    const id = item.conversationId ?? (await createConversation(titleFrom(item.question.shown)));
    await appendExchange(id, item.question, { shown, sent: reply.text }, reply.usage.total);
    return {
      kind: 'sent',
      conversationId: id,
      preview: shown
        .replace(/[#*_`>|-]/g, '')
        .trim()
        .slice(0, 80),
    };
  } catch (e) {
    if (e instanceof AiError && e.temporary && now - item.createdAt < GIVE_UP_MS) return { kind: 'waiting' };
    await takePending(item.id);
    return { kind: 'failed', message: e instanceof Error ? e.message : '送れませんでした' };
  }
}
