import type { AccountKind } from '@/features/accounts/accountKinds';
import type { Category } from '@/features/categories/api';
import { parseNonNegativeYen, parseYen } from '@/lib/money';

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
};

export type FormErrors = DraftErrors & { listPrice?: string; pointsUsed?: string; employerId?: string };

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
  };
}

/** 保存済みの記録をフォームの値にする。残高調整は口座を fromAccountId にまとめて持ち、保存時に向きで振り分ける */
export function toFormValues(t: Transaction): FormValues {
  return {
    type: t.type,
    amount: String(t.amount),
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
  return errors;
}

/** フォームの値を保存する行にする（validateForm を通ったあとに呼ぶ）。その種類で使わない欄は空にする */
export function toTransactionRow(values: FormValues, categories: readonly Category[], today: string) {
  const amount = parseYen(values.amount)!;
  const { fromAccountId, toAccountId } = normalizeAccounts({ ...values, amount });
  return {
    type: values.type,
    amount,
    from_account_id: fromAccountId,
    to_account_id: toAccountId,
    category_id: TRANSACTION_RULES[values.type].categoryKind ? values.categoryId : null,
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
