import AsyncStorage from '@react-native-async-storage/async-storage';

import { AiError } from '@/features/ai/api';

import { loadPhotoContext, recordPhoto } from './scan';

/**
 * ウィジェットから撮った写真で、AI が混み合っていて読み取れなかったもの（小さくした JPEG の base64）。
 * 端末に置いておき、バックグラウンドの確認（features/background）で読み取って記録する
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

/** 置いてある写真を読み取って記録する。混み合いならそこで止めて、残りは次に */
export async function processPhotoQueue(): Promise<void> {
  const queue = await loadPhotoQueue();
  if (queue.length === 0) return;
  const context = await loadPhotoContext();
  const rest = [...queue];
  while (rest.length > 0) {
    const item = rest[0];
    try {
      await recordPhoto(context, item.data, item.key, item.takenAt);
    } catch (e) {
      if (e instanceof AiError && e.temporary) break;
      // 読めない写真は捨てる
    }
    rest.shift();
    await savePhotoQueue(rest);
  }
}
