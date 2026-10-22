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
  /** 対象の送信元だが読み取れなかった */
  | { type: 'unreadable' }
  /** 対象外のメール */
  | { type: 'ignored' };

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
    default:
      return { type: 'ignored' };
  }
}

/** 連携サービス の出金の名目が サンプルデビットの利用か（「サンプルデビット」） */
export const isDebitCardName = (name: string | null) => !!name && /^サンプルデビット/i.test(normalizeText(name));
