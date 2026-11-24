import { formatYen } from '@/lib/money';
import { MAIL_NAMES } from '@/lib/personal';

/** 通知に使う、読み取った1件（記録の内容と金額も） */
export type UnnotifiedImport = {
  id: string;
  status: string;
  kind: string | null;
  amount: number | null;
  raw_payee: string | null;
  subject: string | null;
  transaction_id: string | null;
  transaction: {
    payee: string | null;
    amount: number;
    type: string;
    needs_payee: boolean;
    account_guessed?: boolean;
  } | null;
};

/** クレジットカードの速報（店名なし）で入れた記録の、通知での呼び名 */
const UNNAMED: Record<string, string> = { card_quick: MAIL_NAMES.card, photo: '写真の記録' };

/**
 * 内容（店名・名目）が分からなかった記録の通知（2026-11-24 改善要望。海外での利用など、メールに店名がないことがある）。
 * クレジットカードの速報は店名がないのが当たり前で、あとから届く詳細で入るので、ここには来ない
 */
function unnamedNotification(i: UnnotifiedImport, what: string, transactionId: string) {
  const source = i.kind === 'photo' ? '写真' : 'メール';
  const raw = i.raw_payee?.trim();
  return {
    title:
      i.transaction?.type === 'income' ? '内容が分からない収入を記録しました' : '内容が分からない支払いを記録しました',
    body: `${what}。${source}から店名・名目を読み取れませんでした${raw ? `（${source}の名目: ${raw}）` : ''}。押して内容を入れてください`,
    data: { transactionId },
  };
}

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
    body: i.transaction_id
      ? 'メールのリンクから金額を確かめて、予定の金額を直してください'
      : 'メールのリンクから金額を確かめてください',
    data,
  };
}

/**
 * メールからの記録の通知の文と、押したときに開くもの。通知しないものは null。
 * クレジットカードの詳細で速報の記録に店名を入れたときなど（メールどうしの merged）は通知しない
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
      if (i.transaction?.needs_payee && i.kind !== 'card_quick') return unnamedNotification(i, what, i.transaction_id);
      // 支払い方法が分からず現金にした記録は、開いて口座を確かめてもらう（2026-11-24 改善要望）
      if (i.transaction?.account_guessed) {
        return {
          title: '支払いを記録しました（口座を確かめてください）',
          body: `${what}・支払い方法が分からないので現金にしました`,
          data: { transactionId: i.transaction_id },
        };
      }
      return {
        title: i.transaction?.type === 'income' ? '収入を記録しました' : '支払いを記録しました',
        body: what,
        data: { transactionId: i.transaction_id },
        // 通知の「確認」ボタンで、アプリを開かずに確認済みにできる（内容が分からないものは開いて入れてもらう）
        confirmable: !i.transaction?.needs_payee,
      };
    case 'merged':
      // デビットカード・クレジットカードの詳細のメールで店名を入れようとして、分からなかったとき
      if (i.transaction_id && i.transaction?.needs_payee && (i.kind === 'debit_mail' || i.kind === 'card_detail')) {
        return unnamedNotification(i, what, i.transaction_id);
      }
      // 写真の内容を、メールで先に入った記録にまとめたとき（メールどうしをまとめたときは通知しない）
      return i.kind === 'photo' && i.transaction_id
        ? { title: 'レシートの内容を記録に入れました', body: what, data: { transactionId: i.transaction_id } }
        : null;
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
