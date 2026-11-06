import type { AccountKind } from '@/features/accounts/accountKinds';
import type { Category } from '@/features/categories/api';
import { parseNonNegativeYen, parseSignedYen, parseYen } from '@/lib/money';

import type { Transaction, TransactionInsert } from '../api';
import { isConfirmedOnSave } from '../confirmation';
import { isSalaryCategory } from '../salary';
import {
  type AdjustmentDirection,
  type DraftErrors,
  normalizeAccounts,
  TRANSACTION_RULES,
  type TransactionType,
  validateDraft,
} from '../transactionRules';
import {
  isAdvanceItem,
  type ItemDraft,
  mainCategory,
  ownAmount,
  type SplitAdvance,
  splitAdvances,
  toItemDrafts,
  toItemRows,
  type TransactionItem,
} from '../items';

/** 記録の入力画面（src/app/transaction/[id].tsx）のフォームの値。金額などは入力中の文字のまま持つ */
export type FormValues = {
  type: TransactionType;
  amount: string;
  fromAccountId: string | null;
  toAccountId: string | null;
  adjustmentDirection: AdjustmentDirection;
  categoryId: string | null;
  date: string;
  payee: string;
  memo: string;
  /** 本来の金額・利用ポイント（REQ-18）。空欄なら記録しない */
  listPrice: string;
  pointsUsed: string;
  /** 収入元（給与を払ってくれた働き先）。カテゴリが「給与・アルバイト」のときは必須 */
  employerId: string | null;
  /** 立て替えのとき、それを返してもらった貸し金戻り（No.43。2026-10-24 に元の支払いから変更） */
  relatedTransactionId: string | null;
  /** 貸し金戻りのとき、それで返してもらった立て替え（保存のあとに立て替えの側に書く。setAdvancesRepaidBy） */
  repaidAdvanceIds: string[];
  /** 支払いの内訳の品目の行（2026-11-02。空なら内訳なし。調整の行は保存のときに計算する） */
  items: ItemDraft[];
};

export type FormErrors = DraftErrors & { listPrice?: string; pointsUsed?: string; employerId?: string; items?: string };

export function emptyFormValues(today: string): FormValues {
  return {
    type: 'expense',
    amount: '',
    fromAccountId: null,
    toAccountId: null,
    adjustmentDirection: 'increase',
    categoryId: null,
    date: today,
    payee: '',
    memo: '',
    listPrice: '',
    pointsUsed: '',
    employerId: null,
    relatedTransactionId: null,
    repaidAdvanceIds: [],
    items: [],
  };
}

/**
 * 保存済みの記録をフォームの値にする。残高調整は口座を fromAccountId にまとめて持ち、保存時に向きで振り分ける。
 * advances はその支払いから分けた立て替えの記録（split_from_id）で、金額の欄は立て替えを足した合計にする
 */
export function toFormValues(t: Transaction, advances: readonly Transaction[] = []): FormValues {
  const split = t.type === 'expense' ? advances : [];
  return {
    type: t.type,
    amount: String(t.amount + split.reduce((sum, a) => sum + a.amount, 0)),
    fromAccountId: t.type === 'adjustment' ? (t.from_account_id ?? t.to_account_id) : t.from_account_id,
    toAccountId: t.type === 'adjustment' ? null : t.to_account_id,
    adjustmentDirection: t.type === 'adjustment' && t.from_account_id ? 'decrease' : 'increase',
    categoryId: t.category_id,
    date: t.date,
    payee: t.payee ?? '',
    memo: t.memo ?? '',
    listPrice: t.list_price === null ? '' : String(t.list_price),
    pointsUsed: t.points_used === null ? '' : String(t.points_used),
    employerId: t.employer_id,
    relatedTransactionId: t.related_transaction_id,
    // 立て替えの側に書いてあるので、画面で読み込んでから入れる
    repaidAdvanceIds: [],
    items: t.type === 'expense' ? toItemDrafts(t.items, split) : [],
  };
}

/** 種類ごとのルール（transactionRules.ts）と、ポイント・収入元の欄を確かめる。問題がなければ空のオブジェクト */
export function validateForm(
  values: FormValues,
  accounts: readonly { id: string; kind: AccountKind }[],
  categories: readonly Category[],
): FormErrors {
  const errors: FormErrors = validateDraft({ ...values, amount: parseYen(values.amount) }, accounts, categories);
  if (values.listPrice.trim() !== '' && parseNonNegativeYen(values.listPrice) === null) {
    errors.listPrice = '0以上の整数（円）で入力してください';
  }
  if (values.pointsUsed.trim() !== '' && parseNonNegativeYen(values.pointsUsed) === null) {
    errors.pointsUsed = '0以上の整数で入力してください';
  }
  if (values.type === 'income' && isSalaryCategory(values.categoryId, categories) && !values.employerId) {
    errors.employerId = '収入元を選んでください';
  }
  if (
    values.type === 'expense' &&
    values.items.some((i) => i.amount.trim() !== '' && parseSignedYen(i.amount) === null)
  ) {
    errors.items = '内訳の金額は整数（円）で入力してください';
  } else if (values.type === 'expense' && values.items.some((i) => isAdvanceItem(i) && !(parseYen(i.amount)! > 0))) {
    errors.items = '立て替えの金額は1円以上で入力してください';
  } else if (values.type === 'expense' && !errors.amount && ownAmount(parseYen(values.amount)!, values.items) <= 0) {
    errors.items = '立て替えの合計は金額より少なくしてください';
  }
  return errors;
}

/** 保存する内訳の行（支払いだけ。合計は金額の欄から立て替えの行を引いた自分の分） */
export function itemRows(values: FormValues): TransactionItem[] {
  const total = parseYen(values.amount);
  return values.type === 'expense' && total !== null ? toItemRows(ownAmount(total, values.items), values.items) : [];
}

/** 内訳の立て替えの行（支払いだけ） */
export const advanceItems = (values: FormValues): SplitAdvance[] =>
  values.type === 'expense' ? splitAdvances(values.items) : [];

/**
 * 内訳の立て替えの行から作る立て替えの記録: 元の支払いと同じ口座・日付・内容・確認の状態で、品名はメモに入れる
 */
export function advanceRow(parent: ReturnType<typeof toTransactionRow>, parentId: string, advance: SplitAdvance) {
  return {
    type: 'advance',
    amount: advance.amount,
    from_account_id: parent.from_account_id,
    to_account_id: advance.toAccountId,
    category_id: null,
    date: parent.date,
    payee: parent.payee,
    memo: advance.name,
    is_confirmed: parent.is_confirmed,
    split_from_id: parentId,
  } satisfies Omit<TransactionInsert, 'user_id'>;
}

/** フォームの値を保存する行にする（validateForm を通ったあとに呼ぶ）。その種類で使わない欄は空にする */
export function toTransactionRow(values: FormValues, categories: readonly Category[], today: string) {
  // 支払いは、内訳の立て替えの行を引いた自分の分（立て替えは別の記録になる）
  const total = parseYen(values.amount)!;
  const amount = values.type === 'expense' ? ownAmount(total, values.items) : total;
  const { fromAccountId, toAccountId } = normalizeAccounts({ ...values, amount });
  return {
    type: values.type,
    amount,
    from_account_id: fromAccountId,
    to_account_id: toAccountId,
    // 内訳があれば、いちばん金額の大きい品目のカテゴリを記録のカテゴリにする（一覧などに出す代表）
    category_id: TRANSACTION_RULES[values.type].categoryKind
      ? values.type === 'expense' && itemRows(values).length > 0
        ? mainCategory(itemRows(values))
        : values.categoryId
      : null,
    date: values.date,
    payee: values.payee.trim() || null,
    memo: values.memo.trim() || null,
    list_price: values.listPrice.trim() === '' ? null : parseNonNegativeYen(values.listPrice),
    points_used: values.pointsUsed.trim() === '' ? null : parseNonNegativeYen(values.pointsUsed),
    employer_id: values.type === 'income' && isSalaryCategory(values.categoryId, categories) ? values.employerId : null,
    related_transaction_id: values.type === 'advance' ? values.relatedTransactionId : null,
    is_confirmed: isConfirmedOnSave(values.date, today),
  } satisfies Omit<TransactionInsert, 'user_id'>;
}
