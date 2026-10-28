import type { AccountKind } from '@/features/accounts/accountKinds';

type AccountLike = { id: string; name: string; kind: AccountKind; is_archived: boolean; is_reserved?: boolean };

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

/** 自動入力で使ってよい口座: 非表示と「普段使わない口座」（is_reserved）は使わない（2026-10-28 改善要望） */
const forAuto = <T extends AccountLike>(accounts: readonly T[]) => accounts.filter((a) => !a.is_archived && !a.is_reserved);

/** 支払い方法が分からないときに使う現金の口座（普段使わないものは除く） */
export function defaultCashAccount(accounts: readonly AccountLike[]): string | null {
  return forAuto(accounts).find((a) => a.kind === 'cash')?.id ?? null;
}

/** お店ごとの決まり: サンプル店（サンプル店）での支払いは、サンプル電子マネーで払う（2026-10-28 改善要望） */
const STORE_RULES: { store: RegExp; account: RegExp }[] = [{ store: /サンプル店|emoneya|サンプル店/, account: /サンプル店|emoneya/ }];

/** お店の名前から、払った口座を決める（決まりがなければ null）。名前に「サンプル店」を含む口座をサンプル電子マネーとみなす */
export function matchStoreAccount(payee: string | null, accounts: readonly AccountLike[]): string | null {
  if (!payee?.trim()) return null;
  const text = normalize(payee);
  const rule = STORE_RULES.find((r) => r.store.test(text));
  if (!rule) return null;
  return accounts.find((a) => !a.is_archived && rule.account.test(normalize(a.name)))?.id ?? null;
}

/**
 * レシートなどに書かれた支払い方法（例: 「現金」「サンプルカード」「交通系IC Suica」）から、払った口座を決める。
 * 口座の名前が書かれていればその口座、現金なら現金の口座、電子マネーの名前ならその名前の口座、
 * クレジットとだけ書かれていてクレカの口座が1つならそれ。決められなければ null（AI には口座の名前を渡さず、ここで照らし合わせる）
 */
export function matchPaymentAccount(payment: string | null, accounts: readonly AccountLike[]): string | null {
  if (!payment?.trim()) return null;
  const text = normalize(payment);
  // 口座の名前がそのまま書かれている（長い名前を優先。名前が書かれていれば普段使わない口座でも使う）
  const named = accounts
    .filter((a) => !a.is_archived)
    .filter((a) => normalize(a.name).length >= 2 && text.includes(normalize(a.name)))
    .sort((a, b) => b.name.length - a.name.length)[0];
  if (named) return named.id;
  const usable = forAuto(accounts);
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
