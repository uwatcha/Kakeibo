import type { AccountKind } from '@/features/accounts/accountKinds';

type AccountLike = { id: string; name: string; kind: AccountKind; is_archived: boolean };

/** 電子マネー・QR 決済の名前（レシートの支払い方法と口座の名前の両方に出てくるもの） */
const EMONEY_NAMES = [
  'suica',
  'pasmo',
  'icoca',
  'kitaca',
  'manaca',
  'nanaco',
  'waon',
  'edy',
  'quicpay',
  'paypay',
  '楽天ペイ',
  'd払い',
  'aupay',
  'メルペイ',
  '交通系',
];
const CASH = /現金|お預り|お預かり|お釣り|おつり|cash/;
const CARD = /クレジット|クレカ|カード|visa|jcb|master|amex|diners|credit/;

const normalize = (s: string) =>
  s
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[\s・\-ー]/g, '');

/**
 * レシートなどに書かれた支払い方法（例: 「現金」「サンプルカード」「交通系IC Suica」）から、払った口座を決める。
 * 口座の名前が書かれていればその口座、現金なら現金の口座、電子マネーの名前ならその名前の口座、
 * クレジットとだけ書かれていてクレカの口座が1つならそれ。決められなければ null（AI には口座の名前を渡さず、ここで照らし合わせる）
 */
export function matchPaymentAccount(payment: string | null, accounts: readonly AccountLike[]): string | null {
  if (!payment?.trim()) return null;
  const text = normalize(payment);
  const usable = accounts.filter((a) => !a.is_archived);
  // 口座の名前がそのまま書かれている（長い名前を優先）
  const named = usable
    .filter((a) => normalize(a.name).length >= 2 && text.includes(normalize(a.name)))
    .sort((a, b) => b.name.length - a.name.length)[0];
  if (named) return named.id;
  if (CASH.test(text)) return usable.find((a) => a.kind === 'cash')?.id ?? null;
  const emoney = EMONEY_NAMES.find((n) => text.includes(n));
  if (emoney) {
    const account = usable.find((a) => normalize(a.name).includes(emoney));
    if (account) return account.id;
  }
  if (CARD.test(text)) {
    const cards = usable.filter((a) => a.kind === 'credit_card');
    if (cards.length === 1) return cards[0].id;
  }
  return null;
}
