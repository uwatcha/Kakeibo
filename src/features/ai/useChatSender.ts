import { useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';

import { startBackgroundTask } from '@/features/background/backgroundTask';

import { type Aliases, restoreText } from './anonymize';
import { AiError, appendExchange, createConversation, fetchConversation, sendAiChat } from './api';
import { aiKeys } from './hooks';
import { addPending, takePending } from './pendingSend';
import { titleFrom } from './retention';

/** 混み合いで送れなかったときに送り直す間隔と回数（30秒ごと・最大20回 = 10分） */
const RETRY_INTERVAL_MS = 30_000;
const MAX_RETRIES = 20;

export type ChatItem = {
  id: number | string;
  role: 'user' | 'model';
  /** 画面に出す文（元の名前） */
  shown: string;
  /** AI に送る・AI から来た文（置き換え後の名前） */
  sent: string;
};

/** 送るときの材料。送るたびに今の記録から作り直す（名前は置き換え済み） */
export type ChatContext = { aliases: Aliases; system: string; model: string | null | undefined };

type Options = {
  conversationId: string | undefined;
  /** 送れなかった質問を入力欄に戻す */
  restoreInput: (text: string) => void;
  /** 送れたあと（今日の使用量を読み直すなど） */
  onSent: () => void;
};

/**
 * AI 相談の送信。返事を待つ間の質問、混み合いのときの送り直し（画面を開いている間は30秒ごと・最大10分。
 * 最初に失敗したら端末に送り直し待ちとして置き、そのあとやアプリを閉じている間はバックグラウンドで送り直す）
 */
export function useChatSender({ conversationId, restoreInput, onSent }: Options) {
  const queryClient = useQueryClient();
  // 返事を待っている間の質問（保存は返事と一緒にする）
  const [pending, setPending] = useState<ChatItem | null>(null);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [retry, setRetry] = useState<{ count: number; text: string } | null>(null);
  const retryTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // 送り直し待ちとして端末に置いた質問の id
  const pendingId = useRef<string | null>(null);
  useEffect(
    () => () => {
      if (retryTimer.current) clearTimeout(retryTimer.current);
    },
    [],
  );

  const finish = () => {
    setRetry(null);
    setPending(null);
    setSending(false);
    pendingId.current = null;
    queryClient.invalidateQueries({ queryKey: aiKeys.pending() });
  };

  const attempt = async (
    text: string,
    question: { shown: string; sent: string },
    history: ChatItem[],
    context: () => ChatContext,
    tries: number,
  ) => {
    const { aliases, system, model } = context();
    const messages = history.map((m) => ({ role: m.role, text: m.sent }));
    try {
      const reply = await sendAiChat(system, messages);
      // 送り直し待ちにしていた質問を、バックグラウンドですでに送っていたら保存しない（その会話を開き直す）
      if (pendingId.current && !(await takePending(pendingId.current))) {
        queryClient.invalidateQueries({ queryKey: aiKeys.all });
        finish();
        return;
      }
      // 質問と返事を保存する。初めての質問なら会話を作る
      const id = conversationId ?? (await createConversation(titleFrom(text)));
      await appendExchange(
        id,
        question,
        { shown: restoreText(reply.text, aliases), sent: reply.text },
        reply.usage.total,
      );
      // 読み直してから開く（新しい会話でも読み込み中の画面を挟まない）
      await queryClient.fetchQuery({ queryKey: aiKeys.conversation(id), queryFn: () => fetchConversation(id) });
      queryClient.invalidateQueries({ queryKey: aiKeys.conversations() });
      if (!conversationId) router.setParams({ c: id });
      onSent();
      // 使えなくなったモデルからサーバーが自動で切り替えたときは、表示のモデルも読み直す
      if (reply.model !== model) queryClient.invalidateQueries({ queryKey: aiKeys.status() });
      finish();
    } catch (e) {
      const temporary = e instanceof AiError && e.temporary;
      if (temporary && !pendingId.current) {
        // 初めて混み合いで失敗したら、アプリを閉じても送り直せるよう端末に置く
        pendingId.current = await addPending({
          conversationId: conversationId ?? null,
          question,
          system,
          messages,
          toReal: [...aliases.toReal],
        });
        startBackgroundTask();
      }
      if (temporary && tries >= MAX_RETRIES) {
        // 画面での送り直しはやめ、バックグラウンドに任せる（返事が来たら通知）。端末の送り直し待ちは残す
        pendingId.current = null;
        finish();
        return;
      }
      if (temporary) {
        setRetry({ count: tries + 1, text });
        retryTimer.current = setTimeout(() => attempt(text, question, history, context, tries + 1), RETRY_INTERVAL_MS);
        return;
      }
      setError(e instanceof Error ? e.message : '送れませんでした');
      restoreInput(text);
      finish();
    }
  };

  /** 送る。stored はこの会話の保存済みのやりとり */
  const send = (text: string, stored: readonly ChatItem[], context: () => ChatContext, maskedText: string) => {
    if (text === '' || sending) return;
    const question = { shown: text, sent: maskedText };
    const item: ChatItem = { id: 'pending', role: 'user', ...question };
    setPending(item);
    setError(null);
    setSending(true);
    attempt(text, question, [...stored, item], context, 0);
  };

  /** 画面での送り直しをやめ、質問を入力欄に戻す（端末の送り直し待ちからも外す） */
  const cancelRetry = () => {
    if (retryTimer.current) clearTimeout(retryTimer.current);
    if (retry) restoreInput(retry.text);
    if (pendingId.current) takePending(pendingId.current);
    finish();
  };

  return { pending, sending, error, retry, send, cancelRetry, clearError: () => setError(null) };
}
