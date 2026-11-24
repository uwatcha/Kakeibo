import AsyncStorage from '@react-native-async-storage/async-storage';

import { AiError } from '@/features/ai/api';

import { loadPhotoContext, recordPhoto } from './scan';

/**
 * ウィジェットから撮った写真（小さくした JPEG の base64）。撮ったらここに置いてウィジェットを閉じ、すぐ裏で読み取る
 * （2026-10-25 ユーザーの要望: 読み取りを待たずに閉じる）。途中で止められても残るので、バックグラウンドの確認
 * （features/background）とアプリを開いたときに続きから読み取って記録する
 */
type QueuedPhoto = {
  key: string;
  data: string;
  takenAt: number;
  /** 通信・保存の失敗で読み直した回数（MAX_ATTEMPTS で諦める） */
  attempts?: number;
  /** 「あとで続きから記録します」と知らせたか（同じ写真で何度も知らせない） */
  waitNotified?: boolean;
};

/** 通信・保存の失敗で読み直す回数。超えたら諦めて知らせる */
const MAX_ATTEMPTS = 5;

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

/**
 * 置いてある1枚を読み取った結果（記録・重複は email_imports から通知するので、それ以外を返して通知する。2026-11-24
 * ユーザーの要望: 失敗したら必ず知らせる）。empty = 記録できる内容がない、failed = 記録できずに諦めた、
 * waiting = 混み合い・通信の失敗で、あとで続きから記録する
 */
export type QueueOutcome =
  { key: string; kind: 'empty' } | { key: string; kind: 'failed' | 'waiting'; message: string };

const errorText = (e: unknown) => (e instanceof Error ? e.message : String(e));

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

/** 置いてある1枚を書き換える（読み直した回数など） */
async function updateQueued(item: QueuedPhoto) {
  await savePhotoQueue((await loadPhotoQueue()).map((q) => (q.key === item.key ? item : q)));
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
      // AI の混み合い・通信の失敗（AiError の temporary）: 写真は残し、次の確認で続きから。最初の1回だけ知らせる
      if (e instanceof AiError && e.temporary) {
        if (!item.waitNotified) {
          outcomes.push({ key: item.key, kind: 'waiting', message: e.message });
          await updateQueued({ ...item, waitNotified: true });
        }
        break;
      }
      // AI に断られた・キーが使えないなど: 読み直しても同じなので、理由を知らせて捨てる
      if (e instanceof AiError) {
        outcomes.push({ key: item.key, kind: 'failed', message: e.message });
      } else {
        // 口座の読み込み・記録の保存の失敗（通信など）: 何回かは残して読み直す
        const attempts = (item.attempts ?? 0) + 1;
        if (attempts < MAX_ATTEMPTS) {
          if (!item.waitNotified) {
            outcomes.push({ key: item.key, kind: 'waiting', message: `記録を保存できませんでした（${errorText(e)}）` });
          }
          await updateQueued({ ...item, attempts, waitNotified: true });
          break;
        }
        outcomes.push({
          key: item.key,
          kind: 'failed',
          message: `${MAX_ATTEMPTS}回試しましたが、記録を保存できませんでした（${errorText(e)}）`,
        });
      }
    }
    await removeQueued(item.key);
  }
  return outcomes;
}
