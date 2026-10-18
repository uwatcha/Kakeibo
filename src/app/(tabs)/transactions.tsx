import { router } from 'expo-router';
import { useState } from 'react';
import { RefreshControl, SectionList, StyleSheet, View } from 'react-native';
import { Divider, FAB, IconButton, List, Text, useTheme } from 'react-native-paper';

import { QueryState } from '@/components/QueryState';
import type { Account } from '@/features/accounts/api';
import { useAccounts } from '@/features/accounts/hooks';
import type { Category } from '@/features/categories/api';
import { useCategories } from '@/features/categories/hooks';
import { categoryLabel } from '@/features/categories/tree';
import type { Transaction } from '@/features/transactions/api';
import { useMonthTransactions } from '@/features/transactions/hooks';
import { groupByDate, monthTotals } from '@/features/transactions/list';
import { amountSign, TRANSACTION_RULES } from '@/features/transactions/transactionRules';
import { addMonths, formatDay, formatMonth, monthStart, toTokyoDateString } from '@/lib/date';
import { formatYen } from '@/lib/money';

function describeAccounts(t: Transaction, accounts: readonly Account[]): string {
  const name = (id: string | null) => accounts.find((a) => a.id === id)?.name ?? '';
  if (t.from_account_id && t.to_account_id) return `${name(t.from_account_id)} → ${name(t.to_account_id)}`;
  if (t.type === 'adjustment')
    return `${name(t.from_account_id ?? t.to_account_id)}（${t.to_account_id ? '増' : '減'}）`;
  return name(t.from_account_id ?? t.to_account_id);
}

function TransactionRow({
  transaction: t,
  accounts,
  categories,
}: {
  transaction: Transaction;
  accounts: readonly Account[];
  categories: readonly Category[];
}) {
  const theme = useTheme();
  const rule = TRANSACTION_RULES[t.type];
  const title =
    t.type === 'expense' || t.type === 'income'
      ? (categoryLabel(t.category_id, categories) ?? `${rule.label}（未分類）`)
      : rule.label;
  const description = [describeAccounts(t, accounts), t.payee].filter(Boolean).join('・');
  const sign = amountSign(t.type);
  const color =
    t.type === 'income'
      ? theme.colors.primary
      : t.type === 'expense'
        ? theme.colors.onSurface
        : theme.colors.onSurfaceVariant;

  return (
    <List.Item
      title={title}
      description={description}
      left={(props) => <List.Icon {...props} icon={rule.icon} />}
      right={() => (
        <Text style={[styles.amount, { color }]}>
          {sign}
          {formatYen(t.amount)}
        </Text>
      )}
      onPress={() => router.push({ pathname: '/transaction/[id]', params: { id: t.id } })}
    />
  );
}

export default function TransactionsScreen() {
  const theme = useTheme();
  const [month, setMonth] = useState(() => monthStart(toTokyoDateString()));
  const transactions = useMonthTransactions(month);
  const accounts = useAccounts();
  const categories = useCategories();

  const ready = transactions.data && accounts.data && categories.data;
  const totals = monthTotals(transactions.data ?? []);

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <View style={styles.monthBar}>
        <IconButton icon="chevron-left" accessibilityLabel="前の月" onPress={() => setMonth(addMonths(month, -1))} />
        <Text variant="titleMedium">{formatMonth(month)}</Text>
        <IconButton icon="chevron-right" accessibilityLabel="次の月" onPress={() => setMonth(addMonths(month, 1))} />
      </View>
      <View style={styles.totals}>
        <Text variant="bodyMedium">収入 {formatYen(totals.income)}</Text>
        <Text variant="bodyMedium">支出 {formatYen(totals.expense)}</Text>
        <Text variant="bodyMedium" style={styles.bold}>
          差額 {formatYen(totals.income - totals.expense)}
        </Text>
      </View>
      <Divider />

      {!ready ? (
        <QueryState
          isLoading={!(transactions.error ?? accounts.error ?? categories.error)}
          error={transactions.error ?? accounts.error ?? categories.error}
          onRetry={() => {
            transactions.refetch();
            accounts.refetch();
            categories.refetch();
          }}
        />
      ) : (
        <SectionList
          sections={groupByDate(transactions.data!)}
          keyExtractor={(t) => t.id}
          renderSectionHeader={({ section }) => (
            <List.Subheader style={{ backgroundColor: theme.colors.background }}>
              {formatDay(section.date)}
            </List.Subheader>
          )}
          renderItem={({ item }) => (
            <TransactionRow transaction={item} accounts={accounts.data!} categories={categories.data!} />
          )}
          ListEmptyComponent={
            <Text style={styles.empty} variant="bodyMedium">
              この月の記録はありません
            </Text>
          }
          contentContainerStyle={styles.listContent}
          refreshControl={<RefreshControl refreshing={transactions.isRefetching} onRefresh={transactions.refetch} />}
          stickySectionHeadersEnabled
        />
      )}

      <FAB
        icon="plus"
        style={styles.fab}
        accessibilityLabel="記録する"
        onPress={() => router.push({ pathname: '/transaction/[id]', params: { id: 'new' } })}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  monthBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  totals: { flexDirection: 'row', justifyContent: 'space-around', paddingBottom: 8, paddingHorizontal: 8 },
  bold: { fontWeight: 'bold' },
  amount: { alignSelf: 'center', fontVariant: ['tabular-nums'] },
  empty: { padding: 32, textAlign: 'center' },
  listContent: { paddingBottom: 96 },
  fab: { position: 'absolute', right: 16, bottom: 16 },
});
