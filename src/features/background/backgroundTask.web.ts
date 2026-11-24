// Web 版（ブラウザ）では、バックグラウンドの実行・端末の通知・端末の写真は使えないので何もしない。
// 同じ名前の backgroundTask.ts（Android）と同じものを出す。メールからの記録などはサーバー側で動くので、
// 結果は「記録の確認」で見られる（通知だけが届かない）
export const NOTIFICATION_CHANNEL = 'ai-replies';

export async function processPendingSends(): Promise<void> {}
export async function notifyEmailImports(): Promise<void> {}
export async function processQuickPhotos(): Promise<void> {}
export async function notifyQuickPhotoFailure(): Promise<void> {}
export async function notifyNegativeBalances(): Promise<void> {}
export async function runBackgroundJobs(): Promise<void> {}
export async function prepareNotifications(_options?: { ask?: boolean }): Promise<void> {}
export async function startBackgroundTask(_options?: { askPermission?: boolean }): Promise<void> {}
export async function ensureBackgroundTask(): Promise<void> {}
