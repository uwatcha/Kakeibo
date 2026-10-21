import * as BackgroundTask from 'expo-background-task';
import * as Notifications from 'expo-notifications';
import * as TaskManager from 'expo-task-manager';
import { Platform } from 'react-native';

import { loadPending, trySend } from './pendingSend';

/**
 * アプリを閉じている間も、混み合いで送れなかった AI 相談の質問を送り直す（改善要望）。
 * Android の WorkManager で 15分以上の間隔で動く（端末の電池・通信の状態しだいで遅れる）。
 * 返事が来たら通知を出し、押すとその会話を開く（_layout.tsx の useAiNotificationOpener）
 */
const TASK = 'kakeibo-ai-retry';
const CHANNEL = 'ai-replies';

// 通知はアプリを開いているときも出す
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

/** 送り直し待ちをすべて試し、送れたもの・あきらめたものを通知する。残りがなければ定期の実行をやめる */
export async function processPendingSends(): Promise<void> {
  const now = Date.now();
  for (const item of await loadPending()) {
    const outcome = await trySend(item, now);
    if (outcome.kind === 'sent') {
      await notify('AI の返事が届きました', outcome.preview, { conversationId: outcome.conversationId });
    } else if (outcome.kind === 'failed') {
      await notify(
        'AI に送れませんでした',
        outcome.message,
        item.conversationId ? { conversationId: item.conversationId } : {},
      );
    }
  }
  if ((await loadPending()).length === 0) await stopBackgroundSend();
}

TaskManager.defineTask(TASK, async () => {
  try {
    await processPendingSends();
    return BackgroundTask.BackgroundTaskResult.Success;
  } catch {
    return BackgroundTask.BackgroundTaskResult.Failed;
  }
});

async function notify(title: string, body: string, data: Record<string, string>) {
  await Notifications.scheduleNotificationAsync({
    content: { title, body, data },
    trigger: Platform.OS === 'android' ? { channelId: CHANNEL } : null,
  });
}

/** 送り直し待ちができたら呼ぶ。通知の許可を求め、定期の実行を始める */
export async function startBackgroundSend(): Promise<void> {
  try {
    if (Platform.OS === 'android') {
      // Android 13 以降は、通知のチャンネルがあるときだけ許可を求められる
      await Notifications.setNotificationChannelAsync(CHANNEL, {
        name: 'AI 相談の返事',
        importance: Notifications.AndroidImportance.DEFAULT,
      });
    }
    await Notifications.requestPermissionsAsync();
    if (!(await TaskManager.isTaskRegisteredAsync(TASK))) {
      await BackgroundTask.registerTaskAsync(TASK, { minimumInterval: 15 });
    }
  } catch {
    // 使えない端末（Expo Go など）では、画面を開いている間の送り直しだけになる
  }
}

async function stopBackgroundSend(): Promise<void> {
  try {
    if (await TaskManager.isTaskRegisteredAsync(TASK)) await BackgroundTask.unregisterTaskAsync(TASK);
  } catch {
    // 次に動いたときにまたやめる
  }
}
