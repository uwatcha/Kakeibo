import type { AccountKind } from '@/features/accounts/accountKinds';
import type { Category } from '@/features/categories/api';
import { categoryLabel } from '@/features/categories/tree';
import { isConfirmedOnSave } from '@/features/transactions/confirmation';

import type { Aliases } from './anonymize';
import { mainCategory, toItemRows, type TransactionItem } from '@/features/transactions/items';
import { categoryGuideLines } from './categoryGuide';

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
  /** 重なっていそうな、すでにある記録（markDuplicates で入れる） */
  duplicateOf?: string | null;
  /** レシートの品目の内訳（支払いで2品目以上のときだけ。調整の行は保存のときに合計との差で作る。2026-11-02） */
  items?: TransactionItem[];
};

export type PhotoSource = 'receipt' | 'screen' | 'price' | 'other';

type AccountLike = { id: string; kind: AccountKind; isArchived: boolean; isReserved?: boolean };

/** 読み取りの指示。口座は置き換えた名前で渡し、カテゴリは名前（大分類 / 小分類）で選ばせる */
export function extractPrompt(
  today: string,
  accounts: readonly AccountLike[],
  categories: readonly Category[],
  aliases: Pick<Aliases, 'account'>,
  /** 自分で書いた自動入力のルール（設定。なければ null）。ほかの指示より優先させる */
  userRules: string | null = null,
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
    '[{"date":"YYYY-MM-DD","type":"expense|income|transfer","amount":整数の円,"payee":"店名や内容","category":"下の一覧の名前かnull","from":"下の口座の名前かnull","to":"下の口座の名前かnull","source":"receipt|screen|price|other","payment":"書かれている支払い方法かnull","items":[{"name":"品名","amount":整数の円,"category":"カテゴリかnull"}]}]',
    '- expense は支払い（from が払った口座）、income は収入（to が入った口座）、transfer は自分の口座どうしの移動（from と to）',
    '- レシート1枚は合計額（実際に払った額）で1件にする。明細やCSVは1行1件',
    '- レシートに品目が2つ以上書かれていれば、items に品目ごとの内訳を入れる: [{"name":"品名","amount":税込の整数の円,"category":"下の一覧の名前かnull"}]。品目1つずつ、下の「カテゴリの判断基準」に沿って品名からカテゴリを決める（同じレシートでも品目ごとに違ってよい。店の種類やレシート全体で決めない）。品目ごとの割引（「20円引」など）はその品目の金額から引く。合計にかかる割引・ポイント値引き・消費税の端数のずれは items に入れない（合計との差は家計簿の側で「割引・調整」にする）。品目が1つ・読めないなら items は省く',
    '- 品目の金額は税込にする。「外税」のレシート（本体価格が並び、あとで消費税を足す）は、品目ごとに税率を掛けて四捨五入する（「*」「※」「軽」などの軽減税率の印がある品目は 8%、それ以外は 10%。例: 本体 848円・8% → 916円）。内税のレシートは書かれた金額のまま',
    '- レジ袋（有料のレジ袋代）は品目に入れない。国が有料にしたもので、買い物として買ったものではないので、合計との差として家計簿の側で「割引・調整」に入る（2026-11-02 ユーザーの指定）',
    '- 品名の頭や後ろの印（「*」「※」「軽」など）は取り、略した品名は分かる範囲で読みやすくする（例: 「昔ながらのコロッケ（肉」→「昔ながらのコロッケ（肉）」）',
    '- 返金・キャンセルなど符号がマイナスの行は、記録にしない',
    '- 口座が分からなければ null',
    '- source: レシートは receipt、セルフレジ・券売機などの決済完了の画面は screen、自販機などの値段の表示は price、それ以外（明細・CSV など）は other',
    '- payment: レシートや画面に書かれている支払い方法をそのまま（例: 「現金」「クレジット」「サンプルカード」「交通系IC Suica」「PayPay」）。現金のレシートでお預り・お釣りが書かれていれば「現金」。書かれていなければ null',
    '- 自販機などの値段の表示は、買った商品の値段を金額にし、内容は「自販機（商品名）」のようにする。日付は写真から分からなければ今日',
    // 普段使わない口座は、AI に選ばせない（2026-10-28 改善要望: 自動入力で使われることが多かった）
    `口座: ${accounts
      .filter((a) => !a.isArchived && !a.isReserved)
      .map((a) => aliases.account(a.id))
      .join('、')}`,
    `支出のカテゴリ: ${names('expense')}`,
    `収入のカテゴリ: ${names('income')}`,
    ...categoryGuideLines(
      usable.filter((c) => c.kind === 'expense').map((c) => categoryLabel(c.id, usable) ?? c.name),
    ),
    ...(userRules?.trim() ? ['# 自分で決めたルール（ほかの指示と食い違うときは、こちらを優先する）', userRules.trim()] : []),
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
    // 品目の内訳（支払いで、品目が2つ以上のときだけ。品目の割引はその品目の金額から引いてある）
    const items =
      type === 'expense' && Array.isArray(r.items)
        ? toItemRows(
            amount,
            (r.items as Record<string, unknown>[])
              .filter((it) => it && typeof it.amount === 'number')
              .map((it, n) => ({
                key: String(n),
                name: typeof it.name === 'string' ? it.name.trim().slice(0, 60) : '',
                categoryId: typeof it.category === 'string' ? (categoryByName.get(it.category) ?? null) : null,
                amount: String(Math.round(it.amount as number)),
              })),
          )
        : [];
    const hasItems = items.filter((it) => !it.is_adjustment).length >= 2;
    drafts.push({
      key: String(i),
      date,
      type,
      amount,
      payee: typeof r.payee === 'string' && r.payee.trim() !== '' ? r.payee.trim().slice(0, 100) : null,
      // 内訳があれば、いちばん金額の大きい品目のカテゴリを記録のカテゴリにする
      categoryId: type === 'transfer' ? null : hasItems ? (mainCategory(items) ?? category) : category,
      ...(hasItems && { items }),
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
export type ExistingRecord = { id?: string; date: string; amount: number; auto_source: string | null };

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
      duplicateOf: near[0]?.id ?? null,
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
  /** お店ごとの決まり（サンプル店ならサンプル電子マネー）。AI が選んだ口座より優先する */
  byStore: (payee: string | null) => string | null = () => null,
): ImportDraft[] {
  return drafts.map((d) => {
    if (d.type !== 'expense') return d;
    const store = byStore(d.payee);
    if (store) return { ...d, fromAccountId: store, note: 'お店の決まり' };
    if (d.fromAccountId) return d;
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
    ...(d.type === 'expense' && d.items?.length ? { items: d.items } : {}),
  };
}
