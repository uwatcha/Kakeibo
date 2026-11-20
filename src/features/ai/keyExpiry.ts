/** 期限の何日前から赤で出すか（通知も同じ日に出す。claudeKeyReminder.ts） */
const WARN_DAYS = 3;

/** Claude の API キーの期限の表示（「11/23 まで」「期限切れ」）。期限が近いか切れていれば warn */
export function expiryLabel(expiresAt: string | null, now = Date.now()): { text: string; warn: boolean } | null {
  if (!expiresAt) return null;
  const end = new Date(expiresAt);
  const left = end.getTime() - now;
  if (left <= 0) return { text: '期限切れ', warn: true };
  return { text: `${end.getMonth() + 1}/${end.getDate()} まで`, warn: left <= WARN_DAYS * 86_400_000 };
}
