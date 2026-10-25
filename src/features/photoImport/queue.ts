import AsyncStorage from '@react-native-async-storage/async-storage';

import { AiError } from '@/features/ai/api';

import { loadPhotoContext, recordPhoto } from './scan';

/**
 * ウィジェットから撮った写真（小さくした JPEG の base64）。撮ったらここに置いてウィジェットを閉じ、すぐ裏で読み取る
 * （2026-10-25 ユーザーの要望: 読み取りを待たずに閉じる）。途中で止められても残るので、バックグラウンドの確認
 * （features/background）とアプリを開いたときに続きから読み取って記録する
 */
type QueuedPhoto = { key: string; data: string; takenAt: number };

const STORAGE_KEY = 'kakeibo:photoQueue';
/** 置いておく枚数（1枚 数百KB なので多くは置かない） */
const MAX_QUEUED = 10;

export async function loadPhotoQueue(): Promise<QueuedPhoto[]> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as QueuedPhoto[]) : [];
  } catch {
    return [];
  }
}

async function savePhotoQueue(list: QueuedPhoto[]) {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(list.slice(-MAX_QUEUED)));
}

export async function queuePhoto(item: QueuedPhoto): Promise<void> {
  await savePhotoQueue([...(await loadPhotoQueue()).filter((q) => q.key !== item.key), item]);
}

/** 置いてある1枚を読み取った結果（記録・重複は email_imports から通知するので、それ以外を返して通知する） */
export type QueueOutcome = { key: string; kind: 'empty' | 'unreadable' };

let running: Promise<QueueOutcome[]> | null = null;

/**
 * 置いてある写真を読み取って記録する。混み合いならそこで止めて、残りは次に。
 * ウィジェットのすぐあとの読み取りとバックグラウンドの確認が重ならないよう、動いている間は同じ処理を待つ
 * （重なると同じ写真を2回記録する）
 */
export function processPhotoQueue(): Promise<QueueOutcome[]> {
  running ??= runQueue().finally(() => {
    running = null;
  });
  return running;
}

/** 読み終えた1枚を外す（読んでいる間に撮った写真を消さないよう、置いてあるものを読み直してから外す） */
async function removeQueued(key: string) {
  await savePhotoQueue((await loadPhotoQueue()).filter((q) => q.key !== key));
}

async function runQueue(): Promise<QueueOutcome[]> {
  const outcomes: QueueOutcome[] = [];
  let context: Awaited<ReturnType<typeof loadPhotoContext>> | null = null;
  for (;;) {
    const item = (await loadPhotoQueue())[0];
    if (!item) break;
    try {
      context ??= await loadPhotoContext();
      const result = await recordPhoto(context, item.data, item.key, item.takenAt);
      if (!result.first) outcomes.push({ key: item.key, kind: 'empty' });
    } catch (e) {
      if (e instanceof AiError && e.temporary) break;
      // 読めない写真は捨てる
      outcomes.push({ key: item.key, kind: 'unreadable' });
    }
    await removeQueued(item.key);
  }
  return outcomes;
}
