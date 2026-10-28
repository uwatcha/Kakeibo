import * as BackgroundTask from 'expo-background-task';
import * as Notifications from 'expo-notifications';
import * as TaskManager from 'expo-task-manager';
import { Platform } from 'react-native';

import { loadPending, trySend } from '@/features/ai/pendingSend';
import { fetchEmailImportSettings, fetchUnnotified, markNotified, markReviewed } from '@/features/emailImport/api';
import { importNotification } from '@/features/emailImport/notifications';
import { scanNewPhotos } from '@/features/photoImport/scan';
import { loadPhotoQueue, processPhotoQueue, type QueueOutcome } from '@/features/photoImport/queue';
import { loadPhotoImportState } from '@/features/photoImport/settings';

/**
 * アプリを閉じている間に動く仕事（Android の WorkManager で 15分以上の間隔。端末の電池・通信の状態しだいで遅れる）:
 * - 混み合いで送れなかった AI 相談の質問を送り直し、返事が来たら通知する
 * - 新しい写真（カメラ・スクリーンショット）を見て、レシートなどなら記録する（写真からの記録。features/photoImport）
 * - メール・写真から自動で入った記録・重複の可能性・読み取れなかったメールを通知する（サーバーからは通知できないので、ここで確かめる）
 * 通知を押したときの動きは BackgroundRunner.tsx
 */
// 名前は最初に作ったとき（AI の送り直しだけだったころ）のまま。変えると入れてある APK の登録とずれる
const TASK = 'kakeibo-ai-retry';
export const NOTIFICATION_CHANNEL = 'ai-replies';
const CHANNEL = NOTIFICATION_CHANNEL;

// 通知はアプリを開いているときも出す
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

/**
 * 自動で入った記録の通知に付ける「確認」ボタン（2026-10-28 改善要望）。押すとアプリを開かずに確認済みにし、
 * 「記録の確認」の「自動で追加」から外す
 */
const AUTO_RECORD_CATEGORY = 'auto-record';
const CONFIRM_ACTION = 'confirm';
Notifications.setNotificationCategoryAsync(AUTO_RECORD_CATEGORY, [
  { identifier: CONFIRM_ACTION, buttonTitle: '確認', options: { opensAppToForeground: false } },
]).catch(() => undefined);

/** 通知のボタンが押されたとき（アプリが動いていれば、閉じていてもここに来る） */
export async function handleNotificationAction(response: Notifications.NotificationResponse): Promise<boolean> {
  if (response.actionIdentifier !== CONFIRM_ACTION) return false;
  const id = response.notification.request.content.data?.transactionId;
  if (typeof id === 'string') await markReviewed([id]).catch(() => undefined);
  await Notifications.dismissNotificationAsync(response.notification.request.identifier).catch(() => undefined);
  return true;
}
Notifications.addNotificationResponseReceivedListener((response) => {
  handleNotificationAction(response);
});

async function notify(title: string, body: string, data: Record<string, string>, confirmable = false) {
  await Notifications.scheduleNotificationAsync({
    content: { title, body, data, ...(confirmable && { categoryIdentifier: AUTO_RECORD_CATEGORY }) },
    trigger: Platform.OS === 'android' ? { channelId: CHANNEL } : null,
  });
}

/** 送り直し待ちの AI 相談をすべて試し、送れたもの・あきらめたものを通知する */
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
}

/** メールからの記録で、まだ通知していないものを1件ずつ通知する */
export async function notifyEmailImports(): Promise<void> {
  const items = await fetchUnnotified();
  for (const item of items) {
    const message = importNotification(item);
    if (message) await notify(message.title, message.body, message.data, message.confirmable);
  }
  await markNotified(items.map((i) => i.id));
}

/** ウィジェットから撮った写真で、記録しなかったもの（記録・重複はメールと同じく email_imports から通知する） */
async function notifyPhotoOutcomes(outcomes: QueueOutcome[]): Promise<void> {
  for (const o of outcomes) {
    await notify(
      o.kind === 'empty' ? '写真から記録できる内容がありませんでした' : '写真を読み取れませんでした',
      'レシート・決済の画面・値段の表示を撮ってください',
      {},
    );
  }
}

/**
 * ウィジェットから撮った写真を、すぐ裏で読み取って結果を通知する（ウィジェットは撮ったらすぐ閉じる）。
 * 途中でアプリが止められても、写真は読み取り待ちに残り、定期の実行で続きから読む
 */
export async function processQuickPhotos(): Promise<void> {
  await startBackgroundTask();
  await notifyPhotoOutcomes(await processPhotoQueue().catch(() => []));
  await notifyEmailImports().catch(() => undefined);
}

/** メールからの記録を使っているか（Gmail との連携の合言葉を作ってある） */
async function usesEmailImport(): Promise<boolean> {
  try {
    return !!(await fetchEmailImportSettings())?.token_hash;
  } catch {
    return false;
  }
}

/** 写真からの記録を使っているか（この端末でオンにしてある） */
async function usesPhotoImport(): Promise<boolean> {
  return (await loadPhotoImportState()).enabled;
}

/** 今やることを全部やる（アプリを開いたときにも呼ぶ）。どの仕事もなければ定期の実行をやめる */
export async function runBackgroundJobs(): Promise<void> {
  await processPendingSends().catch(() => undefined);
  const photo = await usesPhotoImport();
  if (photo) await scanNewPhotos().catch(() => undefined);
  // ウィジェットから撮って、混み合いで読み取れなかった写真
  const queued = (await loadPhotoQueue()).length > 0;
  if (queued) await notifyPhotoOutcomes(await processPhotoQueue().catch(() => []));
  const email = await usesEmailImport();
  if (email || photo || queued) await notifyEmailImports().catch(() => undefined);
  if (!email && !photo && (await loadPhotoQueue()).length === 0 && (await loadPending()).length === 0) {
    await stopBackgroundTask();
  }
}

TaskManager.defineTask(TASK, async () => {
  try {
    await runBackgroundJobs();
    return BackgroundTask.BackgroundTaskResult.Success;
  } catch {
    return BackgroundTask.BackgroundTaskResult.Failed;
  }
});

/** 通知のチャンネルを作り、許可を求める（Android 13 以降は、チャンネルがあるときだけ許可を求められる） */
export async function prepareNotifications(): Promise<void> {
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(CHANNEL, {
      name: 'AI 相談の返事・メールと写真からの記録',
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  }
  await Notifications.requestPermissionsAsync();
}

/** 仕事ができたら呼ぶ（AI の送り直し待ち・メールからの記録を使うとき）。通知の許可を求め、定期の実行を始める */
export async function startBackgroundTask(): Promise<void> {
  try {
    await prepareNotifications();
    if (!(await TaskManager.isTaskRegisteredAsync(TASK))) {
      await BackgroundTask.registerTaskAsync(TASK, { minimumInterval: 15 });
    }
  } catch {
    // 使えない端末（Expo Go など）では、アプリを開いているときだけになる
  }
}

async function stopBackgroundTask(): Promise<void> {
  try {
    if (await TaskManager.isTaskRegisteredAsync(TASK)) await BackgroundTask.unregisterTaskAsync(TASK);
  } catch {
    // 次に動いたときにまたやめる
  }
}

/** メール・写真からの記録を使っていれば、定期の実行を始めておく（アプリを開いたとき） */
export async function ensureBackgroundTask(): Promise<void> {
  if (
    (await usesEmailImport()) ||
    (await usesPhotoImport()) ||
    (await loadPhotoQueue()).length > 0 ||
    (await loadPending()).length > 0
  ) {
    await startBackgroundTask();
  }
}
