import { formatYen } from '@/lib/money';

/** 通知に使う、読み取った1件（記録の内容と金額も） */
export type UnnotifiedImport = {
  id: string;
  status: string;
  kind: string | null;
  amount: number | null;
  raw_payee: string | null;
  subject: string | null;
  transaction_id: string | null;
  transaction: { payee: string | null; amount: number; type: string; needs_payee: boolean } | null;
};

/** サンプルカードの速報（店名なし）で入れた記録の、通知での呼び名 */
const UNNAMED: Record<string, string> = { card_quick: 'サンプルカード' };

/**
 * メールからの記録の通知の文と、押したときに開くもの。通知しないものは null。
 * サンプルカードの詳細で速報の記録に店名を入れたときなど（merged）は通知しない
 */
export function importNotification(
  i: UnnotifiedImport,
): { title: string; body: string; data: Record<string, string> } | null {
  const amount = i.transaction?.amount ?? i.amount;
  const what = [
    i.transaction?.payee ?? i.raw_payee ?? (i.kind ? UNNAMED[i.kind] : null),
    amount ? formatYen(amount) : null,
  ]
    .filter(Boolean)
    .join(' ');
  switch (i.status) {
    case 'recorded':
      if (!i.transaction_id) return null;
      return {
        title: i.transaction?.type === 'income' ? '収入を記録しました' : '支払いを記録しました',
        body: i.transaction?.needs_payee ? `${what}（内容を入れてください）` : what,
        data: { transactionId: i.transaction_id },
      };
    case 'confirmed_plan':
      return i.transaction_id
        ? { title: '予定を確認しました', body: what, data: { transactionId: i.transaction_id } }
        : null;
    case 'duplicate':
      return { title: '重複の可能性があります', body: what, data: { tab: 'duplicate' } };
    case 'notice':
      return { title: '取り消しなどのお知らせ', body: i.subject ?? 'メールを確かめてください', data: {} };
    case 'unreadable':
      return { title: '読み取れなかったメールがあります', body: i.subject ?? '', data: {} };
    default:
      return null;
  }
}
