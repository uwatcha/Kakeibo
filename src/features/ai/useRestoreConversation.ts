import { router } from 'expo-router';
import { useEffect } from 'react';

import type { Conversation } from './api';
import { loadLastConversation, saveLastConversation } from './lastConversation';

/** アプリを起動してから、最後に開いていた会話を開き直したか（起動し直すまで1回だけ） */
let restored = false;

/**
 * 起動し直して会話が開いていないときは、最後に開いていた会話（なければいちばん新しい会話）を開く。
 * 開いている会話は覚えておく（新しいチャットにしたときは forgetLastConversation で忘れる）
 */
export function useRestoreConversation(
  conversationId: string | undefined,
  conversations: readonly Conversation[] | undefined,
) {
  useEffect(() => {
    if (restored || conversationId || !conversations) return;
    restored = true;
    loadLastConversation().then((last) => {
      const target = conversations.find((c) => c.id === last) ?? conversations[0];
      if (target) router.setParams({ c: target.id });
    });
  }, [conversationId, conversations]);

  useEffect(() => {
    if (!conversationId) return;
    restored = true;
    saveLastConversation(conversationId);
  }, [conversationId]);
}

export const forgetLastConversation = () => saveLastConversation(null);
