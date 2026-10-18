/**
 * 記録の状態
 * - planned: 今日より後の日付。まだ残高に入っていない
 * - unconfirmed: 日付は来たが、人が確認していない（予定として入れた記録・定期支払いで追加した記録）
 * - confirmed: 確認済み
 */
export type RecordStatus = 'planned' | 'unconfirmed' | 'confirmed';

export function recordStatus(t: { date: string; is_confirmed: boolean }, today: string): RecordStatus {
  if (t.date > today) return 'planned';
  return t.is_confirmed ? 'confirmed' : 'unconfirmed';
}

/** 入力画面で保存したとき: 日付が今日以前なら人が見て入れたので確認済み、未来なら予定なので未確認 */
export function isConfirmedOnSave(date: string, today: string): boolean {
  return date <= today;
}
