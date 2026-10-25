// 外から開かれた URL を、アプリ本体の画面（Expo Router）に渡す前に書き換える。
// ウィジェットの kakeibo-quick://add・kakeibo-quick://photo は、背景が透けた別の画面（QuickAddActivity、
// src/features/quick）のための URL。JS はアプリ本体と同じなので、アプリ本体も URL の知らせを受け取ってしまい、
// 「/add」「/photo」を開こうとして Unmatched Route になる（2026-10-25）。アプリ本体では無視する
const QUICK_SCHEME = /^kakeibo-quick:/i;

export function redirectSystemPath({ path, initial }: { path: string; initial: boolean }): string | null {
  if (QUICK_SCHEME.test(path)) return initial ? '/' : null;
  return path;
}
