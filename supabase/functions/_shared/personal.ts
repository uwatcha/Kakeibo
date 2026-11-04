// 使う人ごとに違う値（使っている銀行・カード・メールの送信元など）。公開するコードには仮の値だけを書き、
// 実際の値は環境変数に置く: Edge Function は Supabase のシークレット、アプリのテストは .env.local（雛形は .env.example）。
// アプリの画面で使う値は src/lib/personal.ts が同じ名前の環境変数から読む。
// Deno（Edge Function）と Node（Jest）の両方から読むので、どちらの機能にも頼らない

type EnvHost = {
  Deno?: { env: { get(key: string): string | undefined } };
  process?: { env: Record<string, string | undefined> };
};

function env(key: string): string | undefined {
  const host = globalThis as EnvHost;
  const value = host.Deno ? host.Deno.env.get(key) : host.process?.env[key];
  return value?.trim() ? value.trim() : undefined;
}

function json<T>(key: string, fallback: T): T {
  const raw = env(key);
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

/** メールからの記録で見るメールの送信元（小文字のアドレス） */
export const MAIL_SENDER = {
  /** デビットカードの利用のお知らせ */
  debit: (env('EXPO_PUBLIC_MAIL_SENDER_DEBIT') ?? 'debit@example.com').toLowerCase(),
  /** 銀行の入出金のお知らせ（口座連携サービスから届く） */
  bank: (env('EXPO_PUBLIC_MAIL_SENDER_BANK') ?? 'bank@example.com').toLowerCase(),
  /** クレジットカードの利用のお知らせ */
  card: (env('EXPO_PUBLIC_MAIL_SENDER_CARD') ?? 'card@example.com').toLowerCase(),
  /** 電気の請求のお知らせ */
  electricity: (env('EXPO_PUBLIC_MAIL_SENDER_ELECTRICITY') ?? 'electricity@example.com').toLowerCase(),
  /** ガスの請求のお知らせ */
  gas: (env('EXPO_PUBLIC_MAIL_SENDER_GAS') ?? 'gas@example.com').toLowerCase(),
};

/** 入出金のお知らせの件名に出る銀行の名前（「◯◯にて入金がありました」） */
export const MAIL_BANK_NAME = env('EXPO_PUBLIC_MAIL_BANK_NAME') ?? 'サンプル銀行';

/** デビットカードの名前（記録の内容に入れる） */
export const MAIL_DEBIT_NAME = env('EXPO_PUBLIC_MAIL_DEBIT_NAME') ?? 'サンプルデビット';

/** 銀行の出金のお知らせで、デビットカードの利用を表す名目の書き出し */
export const MAIL_DEBIT_NAME_IN_BANK = env('EXPO_PUBLIC_MAIL_DEBIT_NAME_IN_BANK') ?? 'サンプルデビット';

/**
 * 電子マネーの口座の名前に含まれる言葉と、銀行の出金の名目での書き方（カタカナ）。一般的な電子マネーのほかに足すもの。
 * JSON（例: {"名前の一部": ["カタカナ"]}）
 */
export const TOPUP_ALIASES_EXTRA = json<Record<string, string[]>>('EXPO_PUBLIC_TOPUP_ALIASES', {
  サンプル電子マネー: ['サンプルデンシマネー'],
});
