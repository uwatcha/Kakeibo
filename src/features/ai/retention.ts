/** ピン留めしていない会話を残す日数（最後のやりとりから） */
export const RETENTION_DAYS = 14;

const DAY_MS = 24 * 60 * 60 * 1000;

/** 消えるまでの残り日数（切り上げ。0 なら今日中に消える） */
export function daysUntilDeletion(updatedAt: string, now: Date): number {
  const deleteAt = new Date(updatedAt).getTime() + RETENTION_DAYS * DAY_MS;
  return Math.max(0, Math.ceil((deleteAt - now.getTime()) / DAY_MS));
}

/** これより前に最後のやりとりがあった、ピン留めしていない会話を消す */
export function deletionCutoff(now: Date): string {
  return new Date(now.getTime() - RETENTION_DAYS * DAY_MS).toISOString();
}

/** 最初の質問から会話の題名を作る（1行目を30文字まで） */
export function titleFrom(question: string): string {
  const line = question.trim().split('\n')[0];
  return line.length > 30 ? `${line.slice(0, 30)}…` : line;
}

/** 作ってからこの日数たった会話に、AI がタイトルを付ける（要件 No.44） */
export const AUTO_TITLE_AFTER_DAYS = 1;

/** AI にタイトルを付けてもらう会話か（作ってから1日たっていて、まだ付けていない） */
export function needsAutoTitle(c: { created_at: string; title_generated: boolean }, now: Date): boolean {
  return !c.title_generated && now.getTime() - new Date(c.created_at).getTime() >= AUTO_TITLE_AFTER_DAYS * DAY_MS;
}
