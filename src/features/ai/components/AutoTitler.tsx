import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';

import { type Aliases, maskText, restoreText } from '../anonymize';
import { type Conversation, fetchConversation, generateTitle, saveGeneratedTitle } from '../api';
import { aiKeys } from '../hooks';
import { needsAutoTitle } from '../retention';

/** 無料枠を使いすぎないよう、一度に付けるのはこの件数まで（残りは次に開いたとき） */
const MAX_PER_OPEN = 3;

/**
 * 作ってから1日たった会話に、AI が中身から短いタイトルを付ける（要件 No.44。画面には何も出さない）。
 * そのあとも、やりとりがあれば1日おきに付け直す（話題が大きく変わっていなければ AI が今のタイトルを返す）。
 * AI には名前を置き換えた文を送り、返ってきたタイトルは元の名前に戻して保存する
 */
export function AutoTitler({ conversations, aliases }: { conversations: readonly Conversation[]; aliases: Aliases }) {
  const queryClient = useQueryClient();
  // 同じ会話を何度も頼まない（失敗したものも、この画面を開いている間は頼み直さない）
  const tried = useRef(new Set<string>());

  useEffect(() => {
    const targets = conversations
      .filter((c) => needsAutoTitle(c, new Date()) && !tried.current.has(c.id))
      .slice(0, MAX_PER_OPEN);
    if (targets.length === 0) return;
    targets.forEach((c) => tried.current.add(c.id));
    (async () => {
      for (const c of targets) {
        try {
          const { messages } = await fetchConversation(c.id);
          if (messages.length === 0) continue;
          const { title } = await generateTitle(
            messages.map((m) => ({ role: m.role, text: m.sent })),
            c.title_generated_at ? maskText(c.title, aliases) : undefined,
          );
          if (title) await saveGeneratedTitle(c.id, restoreText(title, aliases));
        } catch {
          // 付けられなくても困らない。次に開いたときにまた試す
        }
      }
      queryClient.invalidateQueries({ queryKey: aiKeys.conversations() });
    })();
  }, [conversations, aliases, queryClient]);

  return null;
}
