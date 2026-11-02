import AsyncStorage from '@react-native-async-storage/async-storage';
import * as MediaLibrary from 'expo-media-library/legacy';

/**
 * 写真からの記録で、記録した（または重複だった）写真を「家計簿の削除候補」アルバムへ移す（2026-11-02 改善要望。
 * 消すか移すかはユーザーが「移す」を選んだ。あとで自分でまとめて消す）。
 * Android では、ほかのアプリ（カメラ）の写真を移すたびにシステムの確認が出る（何枚でも1回）。確認は画面が出ている
 * ときにしか出せないので、読み取りのとき（裏でも動く）は待ちの一覧に置くだけにし、アプリを開いたときにまとめて移す
 */
export const DELETE_CANDIDATE_ALBUM = '家計簿の削除候補';

const STORAGE_KEY = 'kakeibo:photoImport:toMove';
const MAX_WAITING = 200;

async function loadWaiting(): Promise<string[]> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw) as string[];
  } catch {
    // 読めなければ待ちなし
  }
  return [];
}

async function saveWaiting(ids: readonly string[]): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(ids.slice(-MAX_WAITING)));
}

/** 移す写真を待ちの一覧に足す */
export async function queueForAlbum(assetId: string): Promise<void> {
  const waiting = await loadWaiting();
  if (!waiting.includes(assetId)) await saveWaiting([...waiting, assetId]);
}

// 確認の画面から戻るとアプリが前面に戻ったことになり、もう一度呼ばれるので、同時に動かさない
let moving = false;

/**
 * 待ちの写真をまとめてアルバムへ移す（アプリが前面にあるときに呼ぶ）。確認で断られた・移せなかった写真は
 * カメラのアルバムに残したまま、待ちから外す（開くたびに確認を出し続けないため）
 */
export async function moveWaitingPhotos(): Promise<void> {
  if (moving) return;
  moving = true;
  try {
    const waiting = await loadWaiting();
    if (waiting.length === 0) return;
    // 自分で消した写真は移せないので外す
    const exists = await Promise.all(
      waiting.map((id) => MediaLibrary.getAssetInfoAsync(id).then(Boolean, () => false)),
    );
    const ids = waiting.filter((_, i) => exists[i]);
    try {
      if (ids.length > 0) {
        const album = await MediaLibrary.getAlbumAsync(DELETE_CANDIDATE_ALBUM);
        if (album) {
          await MediaLibrary.addAssetsToAlbumAsync(ids, album, false);
        } else {
          // Android では空のアルバムを作れないので、1枚目を移して作る
          const created = await MediaLibrary.createAlbumAsync(DELETE_CANDIDATE_ALBUM, ids[0], false);
          if (ids.length > 1) await MediaLibrary.addAssetsToAlbumAsync(ids.slice(1), created, false);
        }
      }
    } catch {
      // 断られた・移せなかった
    }
    // 移している間に足された写真は残す
    const latest = await loadWaiting();
    await saveWaiting(latest.filter((id) => !waiting.includes(id)));
  } finally {
    moving = false;
  }
}
