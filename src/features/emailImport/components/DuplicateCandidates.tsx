import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { ActivityIndicator, Text, useTheme } from 'react-native-paper';

import { Amount } from '@/components/Amount';
import { ListRow } from '@/components/ListRow';
import { useAccounts } from '@/features/accounts/hooks';
import { fetchSameAmountAround } from '@/features/transactions/api';
import { amountKindOf, describeAccounts, TRANSACTION_RULES } from '@/features/transactions/transactionRules';
import { formatDay } from '@/lib/date';

/** 重複とみなす日付の差（メールの照らし合わせの3日に合わせる） */
const DAYS = 3;

/**
 * 重複の可能性を押したときに出す、重なっていそうな記録のすべて: 同じ金額で前後3日以内の記録（2026-10-28 改善要望）。
 * 押すとその記録を開く
 */
export function DuplicateCandidates({ date, amount }: { date: string; amount: number }) {
  const theme = useTheme();
  const accounts = useAccounts();
  const candidates = useQuery({
    queryKey: ['transactions', 'sameAmountAround', date, amount],
    queryFn: () => fetchSameAmountAround(date, amount, DAYS),
  });
  if (!candidates.data) {
    return <ActivityIndicator style={styles.loading} />;
  }
  if (candidates.data.length === 0) {
    return (
      <Text variant="bodySmall" style={[styles.empty, { color: theme.colors.onSurfaceVariant }]}>
        前後{DAYS}日に同じ金額の記録はありません
      </Text>
    );
  }
  return (
    <View style={[styles.list, { borderLeftColor: theme.colors.outlineVariant }]}>
      {candidates.data.map((t) => (
        <ListRow
          key={t.id}
          title={t.payee || TRANSACTION_RULES[t.type].label}
          subtitle={[formatDay(t.date), describeAccounts(t, accounts.data ?? [])].filter(Boolean).join('・')}
          icon={TRANSACTION_RULES[t.type].icon}
          wrap
          right={<Amount value={t.amount} kind={amountKindOf(t.type)} variant="bodyMedium" />}
          onPress={() => router.push({ pathname: '/transaction/[id]', params: { id: t.id } })}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  loading: { padding: 8 },
  empty: { paddingHorizontal: 16, paddingVertical: 6 },
  list: { marginLeft: 16, borderLeftWidth: 2 },
});
