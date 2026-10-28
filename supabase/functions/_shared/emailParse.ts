// メールからの記録（設計書: デビットカードの利用メールから自動で記録）の、メールの読み取り。
// Deno（Edge Function email-import）とアプリのテスト（src/features/emailImport/parse.test.ts）の両方から使うので、
// Deno や React Native の機能は使わない。AI も使わず、決まった形の文から読み取る

/** メールの種類 */
export type EmailKind =
  | 'debit_mail' // サンプルデビットの利用（サンプル銀行）
  | 'bank_out' // 連携サービス のサンプル銀行の出金
  | 'bank_in' // 連携サービス のサンプル銀行の入金
  | 'card_quick' // サンプルカードの【速報版】（店名なし）
  | 'card_detail'; // サンプルカードの利用のお知らせ（店名あり）

/** 設定でオンオフ・口座を決める単位（メールの種類をまとめたもの） */
export type EmailSource = 'debit_mail' | 'bank_mail' | 'card_mail';

export const SOURCE_OF: Record<EmailKind, EmailSource> = {
  debit_mail: 'debit_mail',
  bank_out: 'bank_mail',
  bank_in: 'bank_mail',
  card_quick: 'card_mail',
  card_detail: 'card_mail',
};

export type MailInput = {
  /** 送信元（「名前 <address>」の形でもよい） */
  from: string;
  subject: string;
  /** 受信日時（ISO）。年の書かれていない日付の年を決めるのに使う */
  date: string;
  /** 本文（テキスト） */
  body: string;
};

export type ParsedItem = {
  kind: EmailKind;
  /** 利用日（YYYY-MM-DD） */
  date: string;
  amount: number;
  /** 利用先・名目（メールのまま。全角・半角はそろえる）。なければ null */
  rawPayee: string | null;
};

export type ParseResult =
  | { type: 'items'; items: ParsedItem[] }
  /** 取り消し・返金などのお知らせ（記録は作らず、知らせるだけ） */
  | { type: 'notice'; text: string }
  /**
   * 電気・ガスの請求のお知らせ（2026-10-24 改善要望）。記録は作らず、定期支払いの予定の金額を直して知らせる。
   * 支払いはクレカ・口座振替なので、実際の支払いはそちらの記録になる（ここで記録すると二重になる）
   */
  | { type: 'bill'; bill: Bill }
  /** 対象の送信元だが読み取れなかった */
  | { type: 'unreadable' }
  /** 対象外のメール */
  | { type: 'ignored' };

export type BillKind = 'electricity_bill' | 'gas_bill';
export type Bill = {
  kind: BillKind;
  /** 請求の月（YYYY-MM）。書かれていなければ null */
  month: string | null;
  /** 請求額。メールに書かれていなければ null（ガスはリンク先でしか見られない） */
  amount: number | null;
};

/**
 * 見るメールの送信元（Apps Script はこの一覧をサーバーの返事から受け取って使う。src/features/emailImport/appsScript.ts の
 * EMAIL_SENDERS は、初めて貼るときの一覧で、これと同じにする。テストで確かめる）
 */
export const MAIL_SENDERS = [
  'debit@example.com',
  'bank@example.com',
  'card@example.com',
  'electricity@example.com',
  'gas@example.com',
];

const pad = (n: number) => String(n).padStart(2, '0');
const ymd = (y: number, m: number, d: number) => `${y}-${pad(m)}-${pad(d)}`;
const yen = (s: string) => Number(s.replace(/[,，\s]/g, ''));

/**
 * 全角英数字・半角カナなどをそろえる（NFKC）。半角カナは全角になる。
 * 長音のような記号（「−」「ｰ」など）は、カタカナの間ならカタカナの長音「ー」にそろえる
 */
export function normalizeText(s: string): string {
  return s
    .normalize('NFKC')
    .replace(/(?<=[ァ-ヶ])[-−‐ｰ－](?=[ァ-ヶ]|$)/g, 'ー')
    .replace(/\s+/g, ' ')
    .trim();
}

/** 受信日時（ISO）の日本時間の年月日 */
function tokyoParts(iso: string): { y: number; m: number; d: number } {
  const t = new Date(new Date(iso).getTime() + 9 * 3600 * 1000);
  return { y: t.getUTCFullYear(), m: t.getUTCMonth() + 1, d: t.getUTCDate() };
}

/** 年の書かれていない月日に、受信日より後にならない年を付ける */
function withYear(month: number, day: number, receivedIso: string): string {
  const r = tokyoParts(receivedIso);
  const year = month > r.m || (month === r.m && day > r.d + 1) ? r.y - 1 : r.y;
  return ymd(year, month, day);
}

const addressOf = (from: string) => (from.match(/<([^>]+)>/)?.[1] ?? from).trim().toLowerCase();

function parseDebit(mail: MailInput): ParseResult {
  if (/取消|取り消し|返金/.test(mail.subject)) return { type: 'notice', text: mail.subject };
  if (!/デビットカードご利用のお知らせ/.test(mail.subject)) return { type: 'ignored' };
  const date = mail.body.match(/【ご利用日時[^】]*】\s*(\d{4})年(\d{1,2})月(\d{1,2})日/);
  const amount = mail.body.match(/【ご利用金額】\s*([\d,]+)\s*円/);
  const payee = mail.body.match(/【ご利用先】[ \t　]*([^\r\n]+)/);
  if (!date || !amount) return { type: 'unreadable' };
  return {
    type: 'items',
    items: [
      {
        kind: 'debit_mail',
        date: ymd(Number(date[1]), Number(date[2]), Number(date[3])),
        amount: yen(amount[1]),
        rawPayee: payee ? normalizeText(payee[1]) : null,
      },
    ],
  };
}

function parseBank(mail: MailInput): ParseResult {
  const subject = mail.subject.match(/サンプル銀行にて(入金|出金)がありました[（(](.*)[）)]\s*$/);
  if (!subject) return /サンプル銀行/.test(mail.subject) ? { type: 'unreadable' } : { type: 'ignored' };
  const text = mail.body.replace(/\s+/g, ' ');
  const date = text.match(/(\d{1,2})\s*月\s*(\d{1,2})\s*日/);
  const amount = text.match(/[￥¥]\s*([\d,]+)/);
  if (!date || !amount) return { type: 'unreadable' };
  return {
    type: 'items',
    items: [
      {
        kind: subject[1] === '入金' ? 'bank_in' : 'bank_out',
        date: withYear(Number(date[1]), Number(date[2]), mail.date),
        amount: yen(amount[1]),
        rawPayee: subject[2].trim() ? normalizeText(subject[2]) : null,
      },
    ],
  };
}

/** サンプルカードの「■利用日: 2026/10/01 ■利用先: … ■利用金額: 4,321 円」を1件ずつ読む */
function parseCard(mail: MailInput): ParseResult {
  if (!/本人ご利用分/.test(mail.subject)) return { type: 'ignored' };
  const quick = /速報/.test(mail.subject);
  const blocks = mail.body.split(/■\s*利用日\s*[:：]/).slice(1);
  const items: ParsedItem[] = [];
  for (const block of blocks) {
    const date = block.match(/^\s*(\d{4})\/(\d{1,2})\/(\d{1,2})/);
    const amount = block.match(/■\s*利用金額\s*[:：]\s*([\d,]+)\s*円/);
    const payee = block.match(/■\s*利用先\s*[:：][ \t　]*([^\r\n]+)/);
    if (!date || !amount) continue;
    items.push({
      kind: quick ? 'card_quick' : 'card_detail',
      date: ymd(Number(date[1]), Number(date[2]), Number(date[3])),
      amount: yen(amount[1]),
      rawPayee: !quick && payee ? normalizeText(payee[1]) : null,
    });
  }
  return items.length > 0 ? { type: 'items', items } : { type: 'unreadable' };
}

/** 送信元と件名でメールの種類を見分けて読み取る */
export function parseMail(mail: MailInput): ParseResult {
  switch (addressOf(mail.from)) {
    case 'debit@example.com':
      return parseDebit(mail);
    case 'bank@example.com':
      return parseBank(mail);
    case 'card@example.com':
      return parseCard(mail);
    case 'electricity@example.com':
      return parseElectricity(mail);
    case 'gas@example.com':
      return parseGas(mail);
    default:
      return { type: 'ignored' };
  }
}

/** 電力会社（電力会社のサイト）の「電気料金等の請求のお知らせ」 */
function parseElectricity(mail: MailInput): ParseResult {
  if (!/請求のお知らせ/.test(mail.subject)) return { type: 'ignored' };
  const text = normalizeText(mail.body);
  const month = text.match(/ご請求月\s*(\d{4})年(\d{1,2})月分/);
  const amount = text.match(/ご請求金額\s*([\d,]+)\s*円/);
  if (!amount) return { type: 'unreadable' };
  return {
    type: 'bill',
    bill: {
      kind: 'electricity_bill',
      month: month ? `${month[1]}-${pad(Number(month[2]))}` : null,
      amount: Number(amount[1].replace(/,/g, '')),
    },
  };
}

/** ガス会社の「請求金額確定のお知らせ」（金額は本文になく、リンク先でしか見られない） */
function parseGas(mail: MailInput): ParseResult {
  if (!/請求金額確定/.test(mail.subject)) return { type: 'ignored' };
  const month = normalizeText(mail.body).match(/(\d{4})年(\d{1,2})月のご利用料金/);
  const amount = normalizeText(mail.body).match(/ご請求金額\s*[:：]?\s*([\d,]+)\s*円/);
  return {
    type: 'bill',
    bill: {
      kind: 'gas_bill',
      month: month ? `${month[1]}-${pad(Number(month[2]))}` : null,
      amount: amount ? Number(amount[1].replace(/,/g, '')) : null,
    },
  };
}

/**
 * 連携サービス の名目が ATM の引き出し・預け入れか（例: 「ATM から現金引出」）。支払い・収入ではなく、銀行と現金の振替にする
 * （2026-10-24 ユーザーの要望）
 */
export const isAtm = (name: string | null) => !!name && /^ATM/i.test(normalizeText(name));

/** 電子マネーの名前と、メールの名目での書き方（カタカナ） */
const TOPUP_ALIASES: Record<string, string[]> = {
  suica: ['スイカ'],
  pasmo: ['パスモ'],
  icoca: ['イコカ'],
  kitaca: ['キタカ'],
  paypay: ['ペイペイ'],
  majica: ['マジカ'],
  nanaco: ['ナナコ'],
  waon: ['ワオン'],
  edy: ['エデイ', 'エディ'],
  サンプル電子マネー: ['サンプルデンシマネー'],
};

type TopUpAccount = { id: string; name: string; kind: string; is_archived: boolean };

const loose = (s: string) => normalizeText(s).toLowerCase().replace(/\s/g, '');

/**
 * 出金の名目が、自分の電子マネー（現金の口座の majica なども）への入金か。入金先の口座を返す（2026-10-28 改善要望:
 * サンプル銀行から電子マネーへの入金は振替にする）。名目に口座の名前か、その読み（例: 「サンプルデンシマネー」→ サンプル電子マネー、
 * 「MAJICA」→ majica）が入っていれば、その口座。from（出金元）自身は除く
 */
export function topUpTarget(raw: string | null, accounts: readonly TopUpAccount[], from: string): string | null {
  if (!raw) return null;
  const text = loose(raw);
  for (const a of accounts) {
    if (a.is_archived || a.id === from || !['emoney', 'cash'].includes(a.kind)) continue;
    const name = loose(a.name);
    const keys = [name, ...Object.entries(TOPUP_ALIASES).flatMap(([k, kana]) => (name.includes(k) ? [k, ...kana] : []))];
    if (keys.some((k) => k.length >= 2 && text.includes(k.toLowerCase()))) return a.id;
  }
  return null;
}

/** 連携サービス の出金の名目が サンプルデビットの利用か（「サンプルデビット」） */
export const isDebitCardName = (name: string | null) => !!name && /^サンプルデビット/i.test(normalizeText(name));
