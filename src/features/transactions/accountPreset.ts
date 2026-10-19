import type { AccountKind } from '@/features/accounts/accountKinds';

import { OTHER_TYPES, PRIMARY_TYPES, TRANSACTION_RULES, type TransactionType } from './transactionRules';

/** 口座の利用履歴から記録するときの最初の種類: その口座を使える種類のうち、画面で前に並ぶもの */
export function defaultTypeForAccount(kind: AccountKind): TransactionType | null {
  const types = [...PRIMARY_TYPES, ...OTHER_TYPES].filter((t) => t !== 'adjustment');
  return types.find((t) => presetSide(t, kind) !== null) ?? null;
}

/** その種類の記録で、口座をどちらの欄に入れるか（出る側を優先）。入れられなければ null */
export function presetSide(type: TransactionType, kind: AccountKind): 'from' | 'to' | null {
  const rule = TRANSACTION_RULES[type];
  if (rule.from?.kinds.includes(kind)) return 'from';
  if (rule.to?.kinds.includes(kind)) return 'to';
  return null;
}
