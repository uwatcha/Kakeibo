import { useQueryClient } from '@tanstack/react-query';
import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';
import { useEffect } from 'react';
import { AppState } from 'react-native';

import { useAuth } from '@/features/auth/AuthProvider';

import { ensureBackgroundTask, handleNotificationAction, runBackgroundJobs } from './backgroundTask';

/**
 * アプリを開いた・前面に戻ったときに、バックグラウンドの仕事（AI 相談の送り直し・メールからの記録の通知）をすぐやる。
 * 画面には何も出さない。通知を押したら、その会話・記録・確認の画面を開く
 */
export function BackgroundRunner() {
  const { session } = useAuth();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!session) return;
    const run = () =>
      runBackgroundJobs()
        .catch(() => undefined)
        .finally(() => queryClient.invalidateQueries());
    ensureBackgroundTask();
    run();
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') run();
    });
    return () => subscription.remove();
  }, [session, queryClient]);

  const response = Notifications.useLastNotificationResponse();
  useEffect(() => {
    if (!session || !response) return;
    // 通知の「確認」ボタン（アプリが閉じていて、開いたときに届いたもの）
    if (response.actionIdentifier !== Notifications.DEFAULT_ACTION_IDENTIFIER) {
      handleNotificationAction(response).then(() => {
        Notifications.clearLastNotificationResponse();
        queryClient.invalidateQueries();
      });
      return;
    }
    const data = response.notification.request.content.data ?? {};
    if (typeof data.conversationId === 'string') {
      router.navigate({ pathname: '/ai', params: { c: data.conversationId } });
    } else if (typeof data.transactionId === 'string') {
      router.push({ pathname: '/transaction/[id]', params: { id: data.transactionId } });
    } else if (typeof data.tab === 'string') {
      router.push({ pathname: '/unconfirmed', params: { tab: data.tab } });
    } else if (data.screen === 'ai-settings') {
      router.push('/ai-settings');
    }
    Notifications.clearLastNotificationResponse();
  }, [session, response, queryClient]);

  return null;
}
