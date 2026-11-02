import type { EmailSource } from '../../../supabase/functions/_shared/emailParse';

/** 記録してからこの日数たってもメールが来なければ「明細にない」とする（メールが遅れて届くことがあるので） */
export const STATEMENT_GRACE_DAYS = 3;
/** さかのぼって見る日数 */
export const STATEMENT_LOOKBACK_DAYS = 90;

type Record = {
  id: string;
  type: string;
  from_account_id: string | null;
  to_account_id: string | null;
};

/**
 * メールが来るはずの、口座の動きか: 連携サービス（サンプル銀行）は入出金の両方、サンプルデビット・サンプルカードは使ったとき（出金）だけ
 * （カードへの引き落としは銀行の側の 連携サービス のメールで分かる）
 */
export function expectsEmail(
  t: Pick<Record, 'type' | 'from_account_id' | 'to_account_id'>,
  sources: readonly { source: EmailSource; accountId: string }[],
): boolean {
  if (t.type === 'adjustment') return false;
  return sources.some(
    (s) => t.from_account_id === s.accountId || (s.source === 'bank_mail' && t.to_account_id === s.accountId),
  );
}

/**
 * 明細にない記録（2026-11-02 ユーザーの要望。ネット通帳との突き合わせで、手入力した入金が通帳になかった）:
 * メールの来る口座への手入力の記録のうち、どのメールとも結び付いていない（重複として見送られた・予定を確認した、のどちらもない）もの
 */
export function notOnStatement<T extends Record>(
  records: readonly T[],
  sources: readonly { source: EmailSource; accountId: string }[],
  matched: ReadonlySet<string>,
): T[] {
  return records.filter((t) => expectsEmail(t, sources) && !matched.has(t.id));
}
