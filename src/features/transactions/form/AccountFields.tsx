import { type Control, Controller, type FieldErrors } from 'react-hook-form';

import type { Account } from '@/features/accounts/api';

import { AccountPicker } from '../components/AccountPicker';
import { TRANSACTION_RULES, type TransactionType } from '../transactionRules';
import type { FormValues } from './values';

type Props = {
  control: Control<FormValues>;
  errors: FieldErrors<FormValues>;
  type: TransactionType;
  accounts: readonly Account[];
  balances: ReadonlyMap<string, number> | undefined;
};

/** 口座の欄。残高調整は「口座」1つ（向きは別の欄）、それ以外は種類ごとのルールの出金元・入金先 */
export function AccountFields({ control, errors, type, accounts, balances }: Props) {
  const rule = TRANSACTION_RULES[type];
  const picker = (name: 'fromAccountId' | 'toAccountId', label: string, kinds: typeof rule.from, error?: string) =>
    kinds && (
      <Controller
        control={control}
        name={name}
        render={({ field: { onChange, value } }) => (
          <AccountPicker
            balances={balances}
            rows={2}
            label={label}
            kinds={kinds.kinds}
            accounts={accounts}
            value={value}
            onChange={onChange}
            error={error}
          />
        )}
      />
    );

  if (type === 'adjustment') {
    return picker('fromAccountId', '口座', rule.from, errors.fromAccountId?.message ?? errors.toAccountId?.message);
  }
  return (
    <>
      {picker('fromAccountId', rule.from?.label ?? '', rule.from, errors.fromAccountId?.message)}
      {picker('toAccountId', rule.to?.label ?? '', rule.to, errors.toAccountId?.message)}
    </>
  );
}
