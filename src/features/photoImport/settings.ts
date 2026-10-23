import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * 写真からの記録の、この端末での設定と進み具合（写真はこの端末にあるので、端末ごとに持つ）。
 * since より後に撮った写真だけを見る（使い始める前の写真はさかのぼらない）。見た写真の id は processed に残す
 */
export type PhotoImportState = {
  enabled: boolean;
  /** この時刻（ミリ秒）より後に撮った写真を見る。1枚見るたびに進める */
  since: number;
  /** 見た写真の id（同じ時刻の写真を2回見ないため。新しいものから最大 300件） */
  processed: string[];
  /** 最後に確かめた時刻 */
  lastRunAt: number | null;
};

const STORAGE_KEY = 'kakeibo:photoImport';
const MAX_PROCESSED = 300;

export async function loadPhotoImportState(): Promise<PhotoImportState> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw) as PhotoImportState;
  } catch {
    // 読めなければ使っていないことにする
  }
  return { enabled: false, since: 0, processed: [], lastRunAt: null };
}

export async function savePhotoImportState(state: PhotoImportState): Promise<void> {
  await AsyncStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({ ...state, processed: state.processed.slice(-MAX_PROCESSED) }),
  );
}
