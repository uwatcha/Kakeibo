import { useEffect, useRef } from 'react';
import type { UseFormGetValues, UseFormSetValue } from 'react-hook-form';

import type { Account } from '@/features/accounts/api';
import type { Employer } from '@/features/employers/api';

import { defaultTypeForAccount, presetSide } from '../accountPreset';
import { fetchCategoryHistory } from '../api';
import { guessCategory } from '../categoryGuess';
import { loadLastUsedAccounts } from '../lastUsedAccounts';
import { TRANSACTION_RULES, type TransactionType } from '../transactionRules';
import type { FormValues } from './values';

type LastUsed = Awaited<ReturnType<typeof loadLastUsedAccounts>>;

/** その種類で前回使った口座をフォームに入れる。残高調整は口座を fromAccountId にまとめて持つ */
function applyLastUsed(setValue: UseFormSetValue<FormValues>, type: TransactionType, saved: LastUsed) {
  const from = saved[type]?.fromAccountId ?? null;
  const to = saved[type]?.toAccountId ?? null;
  setValue('fromAccountId', type === 'adjustment' ? (from ?? to) : from);
  setValue('toAccountId', type === 'adjustment' ? null : to);
}

type Options = {
  isNew: boolean;
  accounts: readonly Account[] | undefined;
  employers: readonly Employer[];
  type: TransactionType;
  fromAccountId: string | null;
  getValues: UseFormGetValues<FormValues>;
  setValue: UseFormSetValue<FormValues>;
  /** 口座の利用履歴の＋から開いたときの口座 */
  presetAccountId?: string;
  /** ホームの「足りなくなる口座」の振替の候補から開いたときの振替 */
  presetTransfer?: { from?: string; to?: string; amount?: string };
};

/**
 * 記録の入力画面の自動入力:
 * - 新規: その種類で前回使った口座（REQ-30）。口座の利用履歴から開いたらその口座、振替の候補から開いたらその振替
 * - カテゴリ: 自分で選んだ > 内容から予測（REQ-8） > 口座の既定。自分で選んだものは自動で上書きしない
 * - 収入元を選んだら、内容が空ならその名前
 */
export function useFormAssist({
  isNew,
  accounts,
  employers,
  type,
  fromAccountId,
  getValues,
  setValue,
  presetAccountId,
  presetTransfer,
}: Options) {
  // カテゴリをどこから入れたか
  const categorySource = useRef<'user' | 'payee' | 'account' | null>(null);

  // 新規の支払いで口座を選んだら、その口座の既定のカテゴリを入れる（自分で選んだ・内容から予測したときは除く）
  useEffect(() => {
    if (!isNew || type !== 'expense' || !accounts) return;
    if (categorySource.current === 'user' || categorySource.current === 'payee') return;
    if (categorySource.current === null && getValues('categoryId')) return;
    const fallback = accounts.find((a) => a.id === fromAccountId)?.default_category_id ?? null;
    setValue('categoryId', fallback);
    categorySource.current = fallback ? 'account' : null;
  }, [isNew, type, fromAccountId, accounts, getValues, setValue]);

  // 新規: 開いたときに前回の口座などを入れる
  const lastUsed = useRef<LastUsed>({});
  const preset = useRef<Account | null>(null);
  const initialized = useRef(false);
  const { from: transferFrom, to: transferTo, amount: transferAmount } = presetTransfer ?? {};
  useEffect(() => {
    if (!isNew || !accounts || initialized.current) return;
    initialized.current = true;
    preset.current = accounts.find((a) => a.id === presetAccountId) ?? null;
    loadLastUsedAccounts().then((saved) => {
      lastUsed.current = saved;
      const presetType = preset.current ? defaultTypeForAccount(preset.current.kind) : null;
      if (presetType) setValue('type', presetType);
      const current = getValues('type');
      applyLastUsed(setValue, current, saved);
      const side = preset.current ? presetSide(current, preset.current.kind) : null;
      if (preset.current && side) setValue(side === 'from' ? 'fromAccountId' : 'toAccountId', preset.current.id);
      if (transferFrom && transferTo) {
        setValue('type', 'transfer');
        setValue('fromAccountId', transferFrom);
        setValue('toAccountId', transferTo);
        if (transferAmount) setValue('amount', transferAmount);
      }
    });
  }, [isNew, accounts, presetAccountId, transferFrom, transferTo, transferAmount, getValues, setValue]);

  /** 種類を変える。カテゴリの種類が変わるならカテゴリを外し、新規ならその種類で前回使った口座を入れ直す */
  const changeType = (next: TransactionType) => {
    if (TRANSACTION_RULES[next].categoryKind !== TRANSACTION_RULES[getValues('type')].categoryKind) {
      setValue('categoryId', null);
      categorySource.current = null;
    }
    setValue('type', next);
    if (!isNew) return;
    applyLastUsed(setValue, next, lastUsed.current);
    const account = preset.current;
    const side = account ? presetSide(next, account.kind) : null;
    if (account && side) setValue(side === 'from' ? 'fromAccountId' : 'toAccountId', account.id);
  };

  /** カテゴリが空（か口座の既定）のまま内容を入れたら、同じ内容の過去の記録でいちばん多いカテゴリを入れる */
  const fillCategoryFromPayee = async (payee: string) => {
    const currentType = getValues('type');
    const fillable = () => !getValues('categoryId') || categorySource.current === 'account';
    if (!TRANSACTION_RULES[currentType].categoryKind || !fillable() || payee.trim() === '') return;
    try {
      const guessed = guessCategory(await fetchCategoryHistory(payee.trim(), currentType));
      if (guessed && fillable() && getValues('type') === currentType) {
        setValue('categoryId', guessed);
        categorySource.current = 'payee';
      }
    } catch {
      // 予測できなくても入力は続けられる
    }
  };

  const fillFromEmployer = (employerId: string) => {
    const employer = employers.find((e) => e.id === employerId);
    if (employer && getValues('payee').trim() === '') setValue('payee', employer.name);
  };

  /** 自分でカテゴリを選んだとき（以後は自動で上書きしない） */
  const markCategoryChosen = () => {
    categorySource.current = 'user';
  };

  return { changeType, fillCategoryFromPayee, fillFromEmployer, markCategoryChosen };
}
