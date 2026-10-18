import { router, useLocalSearchParams } from 'expo-router';
import { RefreshControl, SectionList, StyleSheet, View } from 'react-native';
import { Chip, Divider, FAB, IconButton, List, Text, useTheme } from 'react-native-paper';

import { Amount } from '@/components/Amount';
import { QueryState } from '@/components/QueryState';
import type { Account } from '@/features/accounts/api';
import { useAccounts } from '@/features/accounts/hooks';
import type { Category } from '@/features/categories/api';
import { useCategories } from '@/features/categories/hooks';
import { categoryLabel } from '@/features/categories/tree';
import type { Transaction } from '@/features/transactions/api';
import { useMonthTransactions } from '@/features/transactions/hooks';
import { groupByDate, monthTotals } from '@/features/transactions/list';
import { TRANSACTION_RULES } from '@/features/transactions/transactionRules';
import { addMonths, formatDay, formatMonth, monthStart, toTokyoDateString } from '@/lib/date';
import { formatYen } from '@/lib/money';

/** 大分類で絞り込む（その大分類の小分類も含む）。'none' は未分類の支出 */
function filterByCategory(
  transactions: readonly Transaction[],
  categoryId: string | undefined,
  categories: readonly Category[],
): Transaction[] {
  if (!categoryId) return [...transactions];
  if (categoryId === 'none') return transactions.filter((t) => t.type === 'expense' && !t.category_id);
  const ids = new Set([categoryId, ...categories.filter((c) => c.parent_id === categoryId).map((c) => c.id)]);
  return transactions.filter((t) => t.category_id !== null && ids.has(t.category_id));
}

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
  const rule = TRANSACTION_RULES[t.type];
  const title =
    t.type === 'expense' || t.type === 'income'
      ? (categoryLabel(t.category_id, categories) ?? `${rule.label}（未分類）`)
      : rule.label;
  const description = [describeAccounts(t, accounts), t.payee].filter(Boolean).join('・');
  // 収支に入る記録だけ符号を付ける（振替・貸し借りなどは自分のお金の置き場所が変わるだけなので符号なし）
  const kind = t.type === 'income' ? 'income' : t.type === 'expense' ? 'expense' : 'neutral';

  return (
    <List.Item
      title={title}
      description={description}
      left={(props) => <List.Icon {...props} icon={rule.icon} />}
      right={() => <Amount value={t.amount} kind={kind} style={styles.amount} />}
      onPress={() => router.push({ pathname: '/transaction/[id]', params: { id: t.id } })}
    />
  );
}

export default function TransactionsScreen() {
  const theme = useTheme();
  // 集計画面からカテゴリをタップすると month と categoryId（未分類は 'none'）が渡される
  const params = useLocalSearchParams<{ month?: string; categoryId?: string }>();
  // 表示中の月も URL のパラメータで持つ（集計画面から開いたときと同じ仕組みで切り替える）
  const month = params.month ?? monthStart(toTokyoDateString());
  const setMonth = (next: string) => router.setParams({ month: next });
  const categoryFilter = params.categoryId;

  const transactions = useMonthTransactions(month);
  const accounts = useAccounts();
  const categories = useCategories();

  const ready = transactions.data && accounts.data && categories.data;
  const filtered = filterByCategory(transactions.data ?? [], categoryFilter, categories.data ?? []);
  const totals = monthTotals(filtered);
  const filterLabel =
    categoryFilter === 'none' ? '未分類' : categories.data?.find((c) => c.id === categoryFilter)?.name;

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
        <View style={styles.inline}>
          <Text variant="bodyMedium" style={styles.bold}>
            差額{' '}
          </Text>
          <Amount value={totals.income - totals.expense} kind="delta" variant="bodyMedium" style={styles.bold} />
        </View>
      </View>
      {categoryFilter && (
        <View style={styles.filter}>
          <Chip icon="filter" onClose={() => router.setParams({ categoryId: undefined })}>
            {filterLabel ?? 'カテゴリ'}の支出だけ表示中
          </Chip>
        </View>
      )}
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
          sections={groupByDate(filtered)}
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
  filter: { flexDirection: 'row', paddingHorizontal: 16, paddingBottom: 8 },
  bold: { fontWeight: 'bold' },
  inline: { flexDirection: 'row', alignItems: 'baseline' },
  amount: { alignSelf: 'center', fontVariant: ['tabular-nums'] },
  empty: { padding: 32, textAlign: 'center' },
  listContent: { paddingBottom: 96 },
  fab: { position: 'absolute', right: 16, bottom: 16 },
});
