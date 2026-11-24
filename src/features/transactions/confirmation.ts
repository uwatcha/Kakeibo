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

/**
 * 口座が空のままの記録（未確認の記録だけ口座を空にできる。2026-11-24 ユーザーの指定）。
 * 確認するときは、先に記録の画面で口座を選ぶ
 */
export function needsAccount(t: {
  type: string;
  from_account_id: string | null;
  to_account_id: string | null;
}): boolean {
  if (t.type === 'adjustment') return false;
  if (t.type === 'expense') return t.from_account_id === null;
  if (t.type === 'income') return t.to_account_id === null;
  return t.from_account_id === null || t.to_account_id === null;
}
