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
const UNNAMED: Record<string, string> = { card_quick: 'サンプルカード', photo: '写真の記録' };

const BILL_NAMES: Record<string, string> = { electricity_bill: '電気代', gas_bill: 'ガス代' };

/**
 * 電気・ガスの請求のお知らせ: 請求額が分かって予定があれば予定を直したと知らせ、金額が分からなければ入れてもらう。
 * 予定があれば押すとその予定を開く
 */
function billNotification(i: UnnotifiedImport): { title: string; body: string; data: Record<string, string> } {
  const name = BILL_NAMES[i.kind ?? ''] ?? '請求';
  const month = i.subject ? `（${i.subject}）` : '';
  const data: Record<string, string> = i.transaction_id ? { transactionId: i.transaction_id } : {};
  if (i.amount) {
    return {
      title: `${name}の請求が届きました${month}`,
      body: i.transaction_id ? `${formatYen(i.amount)}（予定の金額を直しました）` : formatYen(i.amount),
      data,
    };
  }
  return {
    title: `${name}の請求額が確定しました${month}`,
    body: i.transaction_id ? 'メールのリンクから金額を確かめて、予定の金額を直してください' : 'メールのリンクから金額を確かめてください',
    data,
  };
}

/**
 * メールからの記録の通知の文と、押したときに開くもの。通知しないものは null。
 * サンプルカードの詳細で速報の記録に店名を入れたときなど（merged）は通知しない
 */
export function importNotification(
  i: UnnotifiedImport,
): { title: string; body: string; data: Record<string, string>; confirmable?: boolean } | null {
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
        // 通知の「確認」ボタンで、アプリを開かずに確認済みにできる（内容が分からないものは開いて入れてもらう）
        confirmable: !i.transaction?.needs_payee,
      };
    case 'confirmed_plan':
      return i.transaction_id
        ? { title: '予定を確認しました', body: what, data: { transactionId: i.transaction_id } }
        : null;
    case 'duplicate':
      return { title: '重複の可能性があります', body: what, data: { tab: 'duplicate' } };
    case 'notice':
      return { title: '取り消しなどのお知らせ', body: i.subject ?? 'メールを確かめてください', data: {} };
    case 'bill':
      return billNotification(i);
    case 'unreadable':
      return { title: '読み取れなかったメールがあります', body: i.subject ?? '', data: {} };
    default:
      return null;
  }
}
