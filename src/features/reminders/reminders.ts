import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';

import { NOTIFICATION_CHANNEL, prepareNotifications } from '@/features/background/backgroundTask';

import { nextOccurrences } from './occurrences';

/**
 * 確認の通知（2026-11-24 改善要望: 自動入力の確認・残高の確認・残高のズレの修正などを、項目ごとに決めた間隔で知らせる）。
 * 設定はこの端末に置き（通知は端末で出すので）、先の回を端末の予約通知に入れておく（アプリを閉じていても届く）。
 * アプリを開いた・設定を変えたときに予約し直す
 */
export type ReminderKind = 'auto' | 'unconfirmed' | 'balance' | 'adjust' | 'reconcile';

/** 通知を押したときに開くもの（BackgroundRunner が見る） */
type ReminderTarget = { tab: string } | { screen: 'home' | 'accounts' | 'reconcile' };

export const REMINDERS: { kind: ReminderKind; label: string; body: string; target: ReminderTarget }[] = [
  {
    kind: 'auto',
    label: '自動入力の確認',
    body: 'メール・写真から自動で入った記録を確かめましょう',
    target: { tab: 'auto' },
  },
  {
    kind: 'unconfirmed',
    label: '未確認の記録の確認',
    body: '日付が過ぎた予定を、実際の金額に直して確認しましょう',
    target: { tab: 'unconfirmed' },
  },
  {
    kind: 'balance',
    label: '残高の確認',
    body: '口座の残高が、通帳・財布・アプリの残高と合っているか確かめましょう',
    target: { screen: 'home' },
  },
  {
    kind: 'adjust',
    label: '残高のズレの修正',
    body: '残高がずれている口座は、口座の画面で今の残高に直しましょう',
    target: { screen: 'accounts' },
  },
  {
    kind: 'reconcile',
    label: '明細の照らし合わせ',
    body: '通帳や決済アプリの取引履歴の画面を読み取って、記録の漏れ・重複を確かめましょう',
    target: { screen: 'reconcile' },
  },
];

/** 選べる間隔（日）。0 = 通知しない */
export const INTERVALS: { days: number; label: string }[] = [
  { days: 0, label: 'しない' },
  { days: 1, label: '毎日' },
  { days: 3, label: '3日ごと' },
  { days: 7, label: '毎週' },
  { days: 14, label: '2週間ごと' },
  { days: 30, label: '毎月' },
];

/** 選べる時刻（時） */
export const HOURS = [8, 12, 18, 21] as const;

export type ReminderSettings = {
  /** 通知する時刻（日本時間の時） */
  hour: number;
  /** 項目ごとの間隔（日）と、数え始める日（間隔を変えた日） */
  items: Partial<Record<ReminderKind, { days: number; from: string }>>;
};

const STORAGE_KEY = 'kakeibo:reminders';
const DEFAULT: ReminderSettings = { hour: 21, items: {} };
/** 1つの項目で先に予約しておく回数（アプリをしばらく開かなくても届くように） */
const SCHEDULE_COUNT = 8;
const ID_PREFIX = 'reminder-';

export async function loadReminderSettings(): Promise<ReminderSettings> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (raw) return { ...DEFAULT, ...(JSON.parse(raw) as ReminderSettings) };
  } catch {
    // 読めなければ通知しないことにする
  }
  return DEFAULT;
}

export async function saveReminderSettings(settings: ReminderSettings): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  await scheduleReminders(settings);
}

/** 予約し直す（前の予約は消す）。予約できない端末（Expo Go など）では何もしない */
export async function scheduleReminders(settings?: ReminderSettings, now = Date.now()): Promise<void> {
  try {
    const current = settings ?? (await loadReminderSettings());
    const scheduled = await Notifications.getAllScheduledNotificationsAsync();
    await Promise.all(
      scheduled
        .filter((n) => n.identifier.startsWith(ID_PREFIX))
        .map((n) => Notifications.cancelScheduledNotificationAsync(n.identifier)),
    );
    const active = REMINDERS.filter((r) => (current.items[r.kind]?.days ?? 0) > 0);
    if (active.length === 0) return;
    await prepareNotifications();
    for (const reminder of active) {
      const { days, from } = current.items[reminder.kind]!;
      for (const [i, date] of nextOccurrences(from, days, current.hour, now, SCHEDULE_COUNT).entries()) {
        await Notifications.scheduleNotificationAsync({
          identifier: `${ID_PREFIX}${reminder.kind}-${i}`,
          content: { title: reminder.label, body: reminder.body, data: reminder.target },
          trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date, channelId: NOTIFICATION_CHANNEL },
        });
      }
    }
  } catch {
    // 予約できなくても、ほかの動きは止めない
  }
}
