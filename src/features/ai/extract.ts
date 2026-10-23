import type { AccountKind } from '@/features/accounts/accountKinds';
import type { Category } from '@/features/categories/api';
import { categoryLabel } from '@/features/categories/tree';
import { isConfirmedOnSave } from '@/features/transactions/confirmation';

import type { Aliases } from './anonymize';

/** AI入力で作れる記録の種類 */
export type ImportType = 'expense' | 'income' | 'transfer';

/** AI が読み取った記録（AI入力の確認の一覧の1行） */
export type ImportDraft = {
  key: string;
  date: string;
  type: ImportType;
  amount: number;
  payee: string | null;
  categoryId: string | null;
  /** AI が選んだ口座（置き換え後の名前から戻したもの）。分からなければ null */
  fromAccountId: string | null;
  toAccountId: string | null;
  /** 同じ金額で日付が前後1日以内の記録がすでにある（または同じ読み取りの中で重なっている） */
  duplicate: boolean;
  /** 何から読み取ったか。receipt = レシート、screen = セルフレジなどの決済完了の画面、price = 自販機などの値段の表示 */
  source: PhotoSource;
  /** 書かれていた支払い方法（例: 「現金」「サンプルカード」「Suica」）。なければ null */
  payment: string | null;
  /** 口座をどう決めたか（確認の一覧に出す） */
  note: string | null;
};

export type PhotoSource = 'receipt' | 'screen' | 'price' | 'other';

type AccountLike = { id: string; kind: AccountKind; isArchived: boolean };

/** 読み取りの指示。口座は置き換えた名前で渡し、カテゴリは名前（大分類 / 小分類）で選ばせる */
export function extractPrompt(
  today: string,
  accounts: readonly AccountLike[],
  categories: readonly Category[],
  aliases: Pick<Aliases, 'account'>,
): string {
  const usable = categories.filter((c) => !c.is_archived);
  const names = (kind: 'expense' | 'income') =>
    usable
      .filter((c) => c.kind === kind)
      .map((c) => categoryLabel(c.id, usable))
      .filter(Boolean)
      .join('、');
  return [
    'あなたは家計簿の入力係です。添付の写真（レシート・明細・値段の表示など）やファイル（CSV・JSON・テキスト）から、お金の記録を読み取ってください。',
    `今日は ${today} です。年が書かれていない日付は、今日より後にならない一番近い年にしてください。`,
    '次の形の JSON の配列だけを返してください。読み取れる記録がなければ空の配列 [] を返す。',
    '[{"date":"YYYY-MM-DD","type":"expense|income|transfer","amount":整数の円,"payee":"店名や内容","category":"下の一覧の名前かnull","from":"下の口座の名前かnull","to":"下の口座の名前かnull","source":"receipt|screen|price|other","payment":"書かれている支払い方法かnull"}]',
    '- expense は支払い（from が払った口座）、income は収入（to が入った口座）、transfer は自分の口座どうしの移動（from と to）',
    '- レシート1枚は合計額で1件にする（品目ごとに分けない）。明細やCSVは1行1件',
    '- 返金・キャンセルなど符号がマイナスの行は、記録にしない',
    '- 口座が分からなければ null',
    '- source: レシートは receipt、セルフレジ・券売機などの決済完了の画面は screen、自販機などの値段の表示は price、それ以外（明細・CSV など）は other',
    '- payment: レシートや画面に書かれている支払い方法をそのまま（例: 「現金」「クレジット」「サンプルカード」「交通系IC Suica」「PayPay」）。現金のレシートでお預り・お釣りが書かれていれば「現金」。書かれていなければ null',
    '- 自販機などの値段の表示は、買った商品の値段を金額にし、内容は「自販機（商品名）」のようにする。日付は写真から分からなければ今日',
    `口座: ${accounts
      .filter((a) => !a.isArchived)
      .map((a) => aliases.account(a.id))
      .join('、')}`,
    `支出のカテゴリ: ${names('expense')}`,
    `収入のカテゴリ: ${names('income')}`,
  ].join('\n');
}

const DATE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * AI の返事（JSON の配列）を確認の一覧の行にする。形がおかしい行は捨てる。
 * 口座は置き換えた名前から元の口座に、カテゴリは名前から id に戻す
 */
export function toDrafts(
  records: unknown,
  accounts: readonly { id: string }[],
  categories: readonly Category[],
  aliases: Pick<Aliases, 'account'>,
): ImportDraft[] {
  if (!Array.isArray(records)) return [];
  const accountByAlias = new Map(accounts.map((a) => [aliases.account(a.id), a.id]));
  const categoryByName = new Map(
    categories.filter((c) => !c.is_archived).map((c) => [categoryLabel(c.id, categories) ?? c.name, c.id]),
  );
  const drafts: ImportDraft[] = [];
  records.forEach((r: Record<string, unknown>, i) => {
    if (typeof r !== 'object' || r === null) return;
    const type = r.type === 'income' || r.type === 'transfer' ? r.type : r.type === 'expense' ? 'expense' : null;
    const amount = typeof r.amount === 'number' ? Math.round(r.amount) : Number.NaN;
    const date = typeof r.date === 'string' && DATE.test(r.date) ? r.date : null;
    if (!type || !date || !Number.isFinite(amount) || amount <= 0) return;
    const account = (v: unknown) => (typeof v === 'string' ? (accountByAlias.get(v) ?? null) : null);
    const category = typeof r.category === 'string' ? (categoryByName.get(r.category) ?? null) : null;
    drafts.push({
      key: String(i),
      date,
      type,
      amount,
      payee: typeof r.payee === 'string' && r.payee.trim() !== '' ? r.payee.trim().slice(0, 100) : null,
      categoryId: type === 'transfer' ? null : category,
      fromAccountId: type === 'income' ? null : account(r.from),
      toAccountId: type === 'expense' ? null : account(r.to),
      duplicate: false,
      source: r.source === 'receipt' || r.source === 'screen' || r.source === 'price' ? r.source : 'other',
      payment: typeof r.payment === 'string' && r.payment.trim() !== '' ? r.payment.trim().slice(0, 50) : null,
      note: null,
    });
  });
  return drafts;
}

const dayDiff = (a: string, b: string) =>
  Math.abs(Date.parse(`${a}T00:00:00Z`) - Date.parse(`${b}T00:00:00Z`)) / 86_400_000;

/** すでにある記録（日付・金額・メールから自動で入ったか） */
export type ExistingRecord = { date: string; amount: number; auto_source: string | null };

/**
 * 重複の印を付ける: すでにある記録と同じ金額で日付が前後1日以内の行と、読み取りの中で2回目以降に出てきた同じ行。
 * セルフレジの画面・自販機の値段の表示は、メールから入った記録と重なれば「メールで記録済み」とする（重複として最初は外す）
 */
export function markDuplicates(drafts: readonly ImportDraft[], existing: readonly ExistingRecord[]): ImportDraft[] {
  const seen = new Set<string>();
  return drafts.map((d) => {
    const near = existing.filter((t) => t.amount === d.amount && dayDiff(t.date, d.date) <= 1);
    const key = `${d.date}|${d.amount}|${d.payee ?? ''}`;
    const repeated = seen.has(key);
    seen.add(key);
    const fromEmail = (d.source === 'screen' || d.source === 'price') && near.some((t) => t.auto_source === 'email');
    return {
      ...d,
      duplicate: near.length > 0 || repeated,
      note: fromEmail ? 'メールで記録済み' : d.note,
    };
  });
}

/**
 * 支払いの口座を決める（AI が選べなかった行）: 書かれた支払い方法から口座を照らし合わせ（matchPaymentAccount）、
 * 分からないセルフレジの画面・自販機の値段の表示は現金で払ったとみなす（メールで記録済みのものは除く）
 */
export function assignPaymentAccounts(
  drafts: readonly ImportDraft[],
  match: (payment: string | null) => string | null,
  cashAccountId: string | null,
): ImportDraft[] {
  return drafts.map((d) => {
    if (d.type !== 'expense' || d.fromAccountId) return d;
    const matched = match(d.payment);
    if (matched) return { ...d, fromAccountId: matched, note: d.note ?? `支払い方法: ${d.payment}` };
    if ((d.source === 'screen' || d.source === 'price') && d.note !== 'メールで記録済み' && cashAccountId) {
      return { ...d, fromAccountId: cashAccountId, note: '現金と判断' };
    }
    return d;
  });
}

/** AI が口座を選べなかった行に使う口座（確認の一覧の上で選ぶ） */
export type FallbackAccounts = { payFrom: string | null; payTo: string | null };

/** 行の口座を決める: AI が選んだ口座 → なければ上で選んだ口座（支払いは出金元、収入は入金先） */
export function draftAccounts(d: ImportDraft, fallback: FallbackAccounts) {
  return {
    fromAccountId: d.type === 'income' ? null : (d.fromAccountId ?? (d.type === 'expense' ? fallback.payFrom : null)),
    toAccountId: d.type === 'expense' ? null : (d.toAccountId ?? (d.type === 'income' ? fallback.payTo : null)),
  };
}

/** 保存できる行か（その種類に要る口座が決まっている） */
export function isDraftReady(d: ImportDraft, fallback: FallbackAccounts): boolean {
  const { fromAccountId, toAccountId } = draftAccounts(d, fallback);
  return (d.type === 'income' || !!fromAccountId) && (d.type === 'expense' || !!toAccountId);
}

/** 保存する行にする（今日より後の日付なら未確認。記録の入力画面と同じ） */
export function draftToRow(d: ImportDraft, fallback: FallbackAccounts, today: string) {
  const { fromAccountId, toAccountId } = draftAccounts(d, fallback);
  return {
    type: d.type,
    amount: d.amount,
    date: d.date,
    payee: d.payee,
    category_id: d.categoryId,
    from_account_id: fromAccountId,
    to_account_id: toAccountId,
    is_confirmed: isConfirmedOnSave(d.date, today),
  };
}
