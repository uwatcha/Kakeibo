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
  /** 同じ日・同じ金額の記録がすでにある（または同じ読み取りの中で重なっている） */
  duplicate: boolean;
};

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
    '[{"date":"YYYY-MM-DD","type":"expense|income|transfer","amount":整数の円,"payee":"店名や内容","category":"下の一覧の名前かnull","from":"下の口座の名前かnull","to":"下の口座の名前かnull"}]',
    '- expense は支払い（from が払った口座）、income は収入（to が入った口座）、transfer は自分の口座どうしの移動（from と to）',
    '- レシート1枚は合計額で1件にする（品目ごとに分けない）。明細やCSVは1行1件',
    '- 返金・キャンセルなど符号がマイナスの行は、記録にしない',
    '- 口座が分からなければ null',
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
    });
  });
  return drafts;
}

/** すでにある記録と同じ日・同じ金額の行と、読み取りの中で2回目以降に出てきた同じ行に、重複の印を付ける */
export function markDuplicates(
  drafts: readonly ImportDraft[],
  existing: readonly { date: string; amount: number }[],
): ImportDraft[] {
  const known = new Set(existing.map((t) => `${t.date}|${t.amount}`));
  const seen = new Set<string>();
  return drafts.map((d) => {
    const key = `${d.date}|${d.amount}`;
    const duplicate = known.has(key) || seen.has(`${key}|${d.payee ?? ''}`);
    seen.add(`${key}|${d.payee ?? ''}`);
    return { ...d, duplicate };
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
