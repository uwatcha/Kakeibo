import type { AccountKind } from '@/features/accounts/accountKinds';
import {
  type CategoryKind,
  type DraftErrors,
  TRANSACTION_RULES,
  validateDraft,
} from '@/features/transactions/transactionRules';
import { parseYen } from '@/lib/money';

import type { RecurringRule } from './api';
import type { RecurringShift } from './schedule';

/** 定期支払いにできる記録の種類 */
export type RuleType = 'expense' | 'income' | 'transfer';

/** 定期支払いの編集画面（src/app/recurring/[id].tsx）のフォームの値。金額・日は入力中の文字のまま持つ */
export type RuleFormValues = {
  name: string;
  type: RuleType;
  amount: string;
  fromAccountId: string | null;
  toAccountId: string | null;
  categoryId: string | null;
  intervalMonths: '1' | '2';
  dayOfMonth: string;
  holidayShift: RecurringShift;
  startDate: string;
};

export type RuleFormErrors = DraftErrors & { name?: string; dayOfMonth?: string };

/** 1〜31 の日か */
export const isDayOfMonth = (v: string) => /^\d{1,2}$/.test(v.trim()) && Number(v) >= 1 && Number(v) <= 31;

export function emptyRuleForm(today: string): RuleFormValues {
  return {
    name: '',
    type: 'expense',
    amount: '',
    fromAccountId: null,
    toAccountId: null,
    categoryId: null,
    intervalMonths: '1',
    dayOfMonth: '27',
    holidayShift: 'none',
    startDate: today,
  };
}

export function toRuleForm(rule: RecurringRule): RuleFormValues {
  return {
    name: rule.name,
    type: rule.type as RuleType,
    amount: String(rule.amount),
    fromAccountId: rule.from_account_id,
    toAccountId: rule.to_account_id,
    categoryId: rule.category_id,
    intervalMonths: rule.interval_months === 2 ? '2' : '1',
    dayOfMonth: String(rule.day_of_month),
    holidayShift: rule.holiday_shift,
    startDate: rule.start_date,
  };
}

/** 記録の種類ごとのルール（transactionRules.ts）で口座・カテゴリを確かめ、内容と日も確かめる */
export function validateRuleForm(
  values: RuleFormValues,
  accounts: readonly { id: string; kind: AccountKind }[],
  categories: readonly { id: string; kind: CategoryKind }[],
): RuleFormErrors {
  const errors: RuleFormErrors = validateDraft(
    {
      type: values.type,
      amount: parseYen(values.amount),
      fromAccountId: values.fromAccountId,
      toAccountId: values.toAccountId,
      adjustmentDirection: 'increase',
      categoryId: values.categoryId,
      date: values.startDate,
    },
    accounts,
    categories,
  );
  if (values.name.trim() === '') errors.name = '内容を入力してください';
  if (!isDayOfMonth(values.dayOfMonth)) errors.dayOfMonth = '1〜31の数字で入力してください';
  return errors;
}

/** フォームの値を保存する行にする（validateRuleForm を通ったあとに呼ぶ）。その種類で使わない欄は空にする */
export function toRuleRow(values: RuleFormValues) {
  const t = TRANSACTION_RULES[values.type];
  return {
    name: values.name.trim(),
    type: values.type,
    amount: parseYen(values.amount)!,
    from_account_id: t.from ? values.fromAccountId : null,
    to_account_id: t.to ? values.toAccountId : null,
    category_id: t.categoryKind ? values.categoryId : null,
    interval_months: Number(values.intervalMonths),
    day_of_month: Number(values.dayOfMonth),
    holiday_shift: values.holidayShift,
    start_date: values.startDate,
  };
}
