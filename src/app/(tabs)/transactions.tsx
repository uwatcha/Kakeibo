import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Chip, IconButton, Searchbar, Text, useTheme } from 'react-native-paper';

import { AddFab } from '@/components/AddFab';
import { Amount } from '@/components/Amount';
import { QueriesState } from '@/components/QueryState';
import { SectionCard } from '@/components/SectionCard';
import { useAccounts, useAvailableAccountIds } from '@/features/accounts/hooks';
import type { Category } from '@/features/categories/api';
import { useCategories } from '@/features/categories/hooks';
import type { Transaction } from '@/features/transactions/api';
import { useMonthTransactions, useSearchTransactions } from '@/features/transactions/hooks';
import { TransactionDayList } from '@/features/transactions/components/TransactionDayList';
import { monthTotals } from '@/features/transactions/list';
import { touchesAccounts } from '@/features/transactions/scope';
import { buildSearchFilter } from '@/features/transactions/search';
import { addMonths, formatMonth, monthStart, toTokyoDateString } from '@/lib/date';
import { formatYen } from '@/lib/money';
import { SPACING } from '@/theme';

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

/** 月の収入・支出・差額。ラベルは小さく、金額を大きく */
function MonthTotal({ label, children }: { label: string; children: React.ReactNode }) {
  const theme = useTheme();
  return (
    <View style={styles.totalCell}>
      <Text variant="labelMedium" style={{ color: theme.colors.onSurfaceVariant }}>
        {label}
      </Text>
      {children}
    </View>
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

  // 検索中は月をまたいで全期間から探す。入力が止まってから 300ms 後に検索する
  const [searching, setSearching] = useState(false);
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query), 300);
    return () => clearTimeout(timer);
  }, [query]);

  const transactions = useMonthTransactions(month);
  const accounts = useAccounts();
  const categories = useCategories();

  const term = debouncedQuery.trim();
  const matchedCategoryIds =
    term === '' ? [] : (categories.data ?? []).filter((c) => c.name.includes(term)).map((c) => c.id);
  const searchFilter = searching && categories.data ? buildSearchFilter(term, matchedCategoryIds) : null;
  const searchResults = useSearchTransactions(searchFilter);

  const closeSearch = () => {
    setSearching(false);
    setQuery('');
  };

  // 実質残高に含める口座（右上のパネルで選ぶ）が関わる記録だけを出し、月の収入・支出もそれで計算する
  const availableIds = useAvailableAccountIds();
  const listSource = (searching ? (searchResults.data ?? []) : (transactions.data ?? [])).filter(
    (t) => !availableIds || touchesAccounts(t, availableIds),
  );
  const ready =
    !!availableIds &&
    (searching ? searchFilter === null || searchResults.data : transactions.data) &&
    accounts.data &&
    categories.data;
  const filtered = searching ? listSource : filterByCategory(listSource, categoryFilter, categories.data ?? []);
  const totals = monthTotals(filtered);
  // 月や検索語が変わったときだけ、予定の下まで送る
  const viewKey = searching ? `search:${term}` : `${month}:${categoryFilter ?? ''}`;

  const filterLabel =
    categoryFilter === 'none' ? '未分類' : categories.data?.find((c) => c.id === categoryFilter)?.name;

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      {searching ? (
        <Searchbar
          placeholder="内容・メモ・カテゴリ・金額"
          value={query}
          onChangeText={setQuery}
          autoFocus
          icon="arrow-left"
          onIconPress={closeSearch}
          style={[styles.searchbar, { backgroundColor: theme.colors.surface }]}
        />
      ) : (
        <SectionCard style={styles.summary}>
          <View style={styles.monthBar}>
            <IconButton
              icon="chevron-left"
              accessibilityLabel="前の月"
              onPress={() => setMonth(addMonths(month, -1))}
            />
            <Text variant="titleMedium" style={styles.month}>
              {formatMonth(month)}
            </Text>
            <IconButton
              icon="chevron-right"
              accessibilityLabel="次の月"
              onPress={() => setMonth(addMonths(month, 1))}
            />
            <IconButton
              icon="magnify"
              iconColor={theme.colors.primary}
              accessibilityLabel="記録を検索"
              style={styles.searchButton}
              onPress={() => setSearching(true)}
            />
          </View>
          <View style={styles.totals}>
            <MonthTotal label="収入">
              <Text variant="titleMedium" style={styles.totalAmount} numberOfLines={1} adjustsFontSizeToFit>
                {formatYen(totals.income)}
              </Text>
            </MonthTotal>
            <MonthTotal label="支出">
              <Text variant="titleMedium" style={styles.totalAmount} numberOfLines={1} adjustsFontSizeToFit>
                {formatYen(totals.expense)}
              </Text>
            </MonthTotal>
            <MonthTotal label="差額">
              <Amount
                value={totals.income - totals.expense}
                kind="delta"
                variant="titleMedium"
                style={styles.totalAmount}
                numberOfLines={1}
                adjustsFontSizeToFit
              />
            </MonthTotal>
          </View>
          {categoryFilter && (
            <View style={styles.filter}>
              <Chip icon="filter" compact onClose={() => router.setParams({ categoryId: undefined })}>
                {filterLabel ?? 'カテゴリ'}の支出だけ表示中
              </Chip>
            </View>
          )}
        </SectionCard>
      )}

      {!ready ? (
        <QueriesState queries={[transactions, accounts, categories, ...(searching ? [searchResults] : [])]} />
      ) : (
        <TransactionDayList
          transactions={filtered}
          accounts={accounts.data!}
          categories={categories.data!}
          viewKey={viewKey}
          emptyText={searching ? (term === '' ? '' : '一致する記録はありません') : 'この月の記録はありません'}
          refreshing={transactions.isRefetching}
          onRefresh={transactions.refetch}
        />
      )}

      <AddFab
        accessibilityLabel="記録する"
        onPress={() => router.push({ pathname: '/transaction/[id]', params: { id: 'new' } })}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  summary: { marginHorizontal: SPACING.screen, marginTop: 4, paddingBottom: 14 },
  monthBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  month: { fontWeight: '700', minWidth: 96, textAlign: 'center' },
  searchButton: { position: 'absolute', right: 4 },
  searchbar: { marginHorizontal: SPACING.screen, marginTop: 4, marginBottom: 4 },
  totals: { flexDirection: 'row', paddingHorizontal: SPACING.row, gap: 8 },
  totalCell: { flex: 1, alignItems: 'center', gap: 2 },
  totalAmount: { fontWeight: '700' },
  filter: { flexDirection: 'row', justifyContent: 'center', paddingTop: 10 },
});
