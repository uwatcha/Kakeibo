// 使う人ごとに違う値のうち、アプリの画面で使うもの。公開するコードには仮の値だけを書き、実際の値は
// .env.local（雛形は .env.example）と EAS の環境変数に置く。Edge Function の側は supabase/functions/_shared/personal.ts。
// Expo はビルドのときに process.env.EXPO_PUBLIC_… を値に置き換えるので、1つずつ書く（まとめて読むと置き換わらない）

const or = (value: string | undefined, fallback: string) => (value?.trim() ? value.trim() : fallback);

function json<T>(value: string | undefined, fallback: T): T {
  if (!value?.trim()) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

/** メールからの記録で見るメールの送信元（Apps Script を初めて貼るときの一覧。サーバーの一覧と同じにする） */
export const MAIL_SENDERS = [
  or(process.env.EXPO_PUBLIC_MAIL_SENDER_DEBIT, 'debit@example.com'),
  or(process.env.EXPO_PUBLIC_MAIL_SENDER_BANK, 'bank@example.com'),
  or(process.env.EXPO_PUBLIC_MAIL_SENDER_CARD, 'card@example.com'),
  or(process.env.EXPO_PUBLIC_MAIL_SENDER_ELECTRICITY, 'electricity@example.com'),
  or(process.env.EXPO_PUBLIC_MAIL_SENDER_GAS, 'gas@example.com'),
].map((s) => s.toLowerCase());

/** メールからの記録の画面・説明で使う名前 */
export const MAIL_NAMES = {
  /** デビットカード */
  debit: or(process.env.EXPO_PUBLIC_MAIL_DEBIT_NAME, 'サンプルデビット'),
  /** 入出金のお知らせが来る銀行 */
  bank: or(process.env.EXPO_PUBLIC_MAIL_BANK_NAME, 'サンプル銀行'),
  /** 銀行の入出金のお知らせを送ってくる口座連携サービス */
  bankService: or(process.env.EXPO_PUBLIC_MAIL_BANK_SERVICE, '口座連携サービス'),
  /** クレジットカード */
  card: or(process.env.EXPO_PUBLIC_MAIL_CARD_NAME, 'サンプルカード'),
};

/**
 * お店ごとの決まり: 名前が store に当てはまるお店での支払いは、名前が account に当てはまる口座で払う（どちらも正規表現。
 * 比べる前に、全角・半角をそろえ、小文字にし、空白・中点・長音を消す）。JSON の配列
 */
export const STORE_ACCOUNT_RULES = json<{ store: string; account: string }[]>(
  process.env.EXPO_PUBLIC_STORE_ACCOUNT_RULES,
  [{ store: 'サンプル店', account: 'サンプル電子マネ' }],
);
