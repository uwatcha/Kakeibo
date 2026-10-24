import * as Notifications from 'expo-notifications';

import { NOTIFICATION_CHANNEL, prepareNotifications } from '@/features/background/backgroundTask';

/** 予約した通知の名前（入れ直すときに前の予約を消す） */
const ID = 'claude-key-expiry';
/** 期限の何日前に知らせるか */
const DAYS_BEFORE = 3;

/** 期限の DAYS_BEFORE 日前の朝9時（日本時間）。すでに過ぎていれば null */
export function reminderDate(expiresAt: string, now: number): Date | null {
  const day = new Date(new Date(expiresAt).getTime() - DAYS_BEFORE * 86_400_000);
  // 日本時間の日付の 9:00（= UTC の 0:00）
  const tokyo = new Date(day.getTime() + 9 * 3_600_000).toISOString().slice(0, 10);
  const at = new Date(`${tokyo}T00:00:00Z`);
  return at.getTime() > now ? at : null;
}

/**
 * Claude の API キーの期限（作ってから30日）が近づいたら知らせる通知を、端末に予約し直す（2026-10-24 ユーザーの要望）。
 * キーを保存した・外した・AI の状態を読み込んだときに呼ぶ。押すと AI 相談の設定を開く（BackgroundRunner）
 */
export async function scheduleClaudeKeyReminder(expiresAt: string | null, now = Date.now()): Promise<void> {
  try {
    await Notifications.cancelScheduledNotificationAsync(ID);
    if (!expiresAt) return;
    const date = reminderDate(expiresAt, now);
    if (!date) return;
    await prepareNotifications();
    const end = new Date(expiresAt);
    await Notifications.scheduleNotificationAsync({
      identifier: ID,
      content: {
        title: 'Claude の API キーの期限が近づいています',
        body: `${end.getMonth() + 1}/${end.getDate()} までに、新しいキーを作って設定で入れ直してください`,
        data: { screen: 'ai-settings' },
      },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date, channelId: NOTIFICATION_CHANNEL },
    });
  } catch {
    // 予約できない端末（Expo Go など）では、設定の画面の期限の表示だけになる
  }
}
