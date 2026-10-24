import { File, Paths } from 'expo-file-system';

import type { ImportDraft } from './extract';

/**
 * AI入力の途中の状態（2026-10-24 改善要望: 写真を送ったあとアプリを閉じると記録されない）。
 * 「読み取る」を押したら送る内容を、読み取れたら確認の一覧を端末のファイルに置き、保存するか戻るまで残す。
 * 閉じても、次に AI入力を開いたときに続きから読み取る・一覧を出す。写真の base64 は大きいので AsyncStorage ではなくファイル
 */
export type ImportJob = {
  /** 読み取りの基準の日（AI に渡す「今日」） */
  today: string;
  texts: string;
  binaries: { mimeType: string; data: string }[];
  savedAt: number;
  /** 読み取れたら入る。なければまだ読み取っていない */
  drafts?: ImportDraft[];
  selected?: string[];
};

/** これより古いものは捨てる */
const KEEP_MS = 3 * 24 * 60 * 60 * 1000;

const jobFile = () => new File(Paths.document, 'ai-import-job.json');

export function saveImportJob(job: ImportJob): void {
  try {
    const file = jobFile();
    if (!file.exists) file.create();
    file.write(JSON.stringify(job));
  } catch {
    // 置けなくても読み取りは続ける
  }
}

export async function loadImportJob(now = Date.now()): Promise<ImportJob | null> {
  try {
    const file = jobFile();
    if (!file.exists) return null;
    const job = JSON.parse(await file.text()) as ImportJob;
    if (now - job.savedAt > KEEP_MS) {
      clearImportJob();
      return null;
    }
    return job;
  } catch {
    return null;
  }
}

export function clearImportJob(): void {
  try {
    const file = jobFile();
    if (file.exists) file.delete();
  } catch {
    // 消せなくても次に上書きする
  }
}
