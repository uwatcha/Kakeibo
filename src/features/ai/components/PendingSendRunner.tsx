import { useQueryClient } from '@tanstack/react-query';
import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';
import { useEffect } from 'react';
import { AppState } from 'react-native';

import { useAuth } from '@/features/auth/AuthProvider';

import { processPendingSends } from '../backgroundSend';
import { aiKeys } from '../hooks';

/**
 * アプリを開いた・前面に戻ったときに、送り直し待ちの AI 相談の質問をすぐ送ってみる（画面には何も出さない）。
 * 返事の通知を押したら、その会話を開く
 */
export function PendingSendRunner() {
  const { session } = useAuth();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!session) return;
    const run = () =>
      processPendingSends()
        .catch(() => undefined)
        .finally(() => queryClient.invalidateQueries({ queryKey: aiKeys.all }));
    run();
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') run();
    });
    return () => subscription.remove();
  }, [session, queryClient]);

  const response = Notifications.useLastNotificationResponse();
  useEffect(() => {
    if (!session || !response || response.actionIdentifier !== Notifications.DEFAULT_ACTION_IDENTIFIER) return;
    const conversationId = response.notification.request.content.data?.conversationId;
    if (typeof conversationId === 'string') router.navigate({ pathname: '/ai', params: { c: conversationId } });
    Notifications.clearLastNotificationResponse();
  }, [session, response]);

  return null;
}
