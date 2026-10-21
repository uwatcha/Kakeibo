import { router } from 'expo-router';
import { type Control, Controller } from 'react-hook-form';
import { StyleSheet, View } from 'react-native';
import { Button, HelperText, Text } from 'react-native-paper';

import { ChipGroup } from '@/components/ChipGroup';
import type { Account } from '@/features/accounts/api';
import type { Category } from '@/features/categories/api';
import { categoryLabel } from '@/features/categories/tree';
import { formatYen } from '@/lib/money';

import type { Transaction } from '../api';
import type { FormValues } from './values';

/** 立て替えは、何の支払いの立て替えかを選べる（前後1週間の支払いから。No.43） */
export function RelatedExpenseField({
  control,
  expenses,
  categories,
}: {
  control: Control<FormValues>;
  expenses: readonly Transaction[];
  categories: readonly Category[];
}) {
  const describe = (t: Transaction) =>
    `${Number(t.date.slice(5, 7))}/${Number(t.date.slice(8, 10))} ${t.payee || (categoryLabel(t.category_id, categories) ?? '支払い')} ${formatYen(t.amount)}`;
  return (
    <Controller
      control={control}
      name="relatedTransactionId"
      render={({ field: { onChange, value } }) => {
        const options = expenses.map((t) => ({ value: t.id, label: describe(t) }));
        if (value && !options.some((o) => o.value === value)) options.unshift({ value, label: '選択中の支払い' });
        return (
          <View style={styles.field}>
            <Text variant="labelLarge">元の支払い（任意）</Text>
            {options.length > 0 ? (
              <ChipGroup options={options} value={value} onChange={onChange} allowDeselect />
            ) : (
              <HelperText type="info">前後1週間に支払いの記録はありません</HelperText>
            )}
          </View>
        );
      }}
    />
  );
}

/** 支払いの記録にひも付いた立て替え。押すと開く */
export function LinkedAdvances({
  advances,
  accounts,
}: {
  advances: readonly Transaction[];
  accounts: readonly Account[];
}) {
  if (advances.length === 0) return null;
  return (
    <View style={styles.field}>
      <Text variant="labelLarge">この支払いの立て替え</Text>
      {advances.map((t) => (
        <Button
          key={t.id}
          mode="outlined"
          icon="account-cash"
          onPress={() => router.push({ pathname: '/transaction/[id]', params: { id: t.id } })}
        >
          {accounts.find((a) => a.id === t.to_account_id)?.name ?? ''} {formatYen(t.amount)}
        </Button>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({ field: { gap: 4 } });
