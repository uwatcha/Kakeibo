import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { FlatList, RefreshControl, StyleSheet, View } from 'react-native';
import { Chip, IconButton, Searchbar, Text, useTheme } from 'react-native-paper';

import { AddFab } from '@/components/AddFab';
import { Amount } from '@/components/Amount';
import { ListRow } from '@/components/ListRow';
import { QueryState } from '@/components/QueryState';
import { StatusBadge } from '@/components/StatusBadge';
import { SectionCard } from '@/components/SectionCard';
import type { Account } from '@/features/accounts/api';
import { useAccounts } from '@/features/accounts/hooks';
import type { Category } from '@/features/categories/api';
import { useCategories } from '@/features/categories/hooks';
import { categoryIcon } from '@/features/categories/icons';
import { categoryLabel } from '@/features/categories/tree';
import type { Transaction } from '@/features/transactions/api';
import { useMonthTransactions, useSearchTransactions } from '@/features/transactions/hooks';
import { type DaySection, groupByDate, monthTotals } from '@/features/transactions/list';
import { recordStatus } from '@/features/transactions/confirmation';
import { buildSearchFilter } from '@/features/transactions/search';
import { TRANSACTION_RULES } from '@/features/transactions/transactionRules';
import { addMonths, formatDay, formatMonth, monthStart, toTokyoDateString } from '@/lib/date';
import { formatYen } from '@/lib/money';
import { positiveColor, positiveContainer, SPACING } from '@/theme';

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
  const theme = useTheme();
  const rule = TRANSACTION_RULES[t.type];
  const unconfirmed = recordStatus(t, toTokyoDateString()) === 'unconfirmed';
  const isFlow = t.type === 'expense' || t.type === 'income';
  const category = isFlow ? (categoryLabel(t.category_id, categories) ?? `${rule.label}（未分類）`) : rule.label;
  // 内容があればそれを主にし、カテゴリ（種類）と口座は小さく下に出す
  const title = t.payee || category;
  const subtitle = [t.payee ? category : null, describeAccounts(t, accounts)].filter(Boolean).join('・');
  // 収支に入る記録だけ符号を付ける（振替・貸し借りなどは自分のお金の置き場所が変わるだけなので符号なし）
  const kind = t.type === 'income' ? 'income' : t.type === 'expense' ? 'expense' : 'neutral';
  const icon = isFlow ? categoryIcon(t.category_id, categories, rule.icon) : rule.icon;
  const iconColors =
    kind === 'income'
      ? { background: positiveContainer(theme.dark), color: positiveColor(theme.dark) }
      : kind === 'expense'
        ? { background: theme.colors.primaryContainer, color: theme.colors.primary }
        : { background: theme.colors.surfaceVariant, color: theme.colors.onSurfaceVariant };

  return (
    <ListRow
      title={title}
      subtitle={
        <View style={styles.subtitle}>
          {unconfirmed && <StatusBadge status="unconfirmed" />}
          {t.recurring_rule_id && (
            <MaterialCommunityIcons
              name="autorenew"
              size={14}
              color={theme.colors.onSurfaceVariant}
              accessibilityLabel="定期"
            />
          )}
          <Text
            variant="bodySmall"
            numberOfLines={1}
            style={[styles.subtitleText, { color: theme.colors.onSurfaceVariant }]}
          >
            {subtitle}
          </Text>
        </View>
      }
      icon={icon}
      iconBackground={iconColors.background}
      iconColor={iconColors.color}
      right={<Amount value={t.amount} kind={kind} variant="bodyLarge" style={styles.amount} />}
      onPress={() => router.push({ pathname: '/transaction/[id]', params: { id: t.id } })}
    />
  );
}

/** 1日分の記録を1枚のカードにまとめる */
function DayCard({
  section,
  accounts,
  categories,
  planned = false,
}: {
  section: DaySection;
  accounts: readonly Account[];
  categories: readonly Category[];
  /** 今日より後の日付。まだ残高に入っていないので、塗らずに破線の枠で見せる */
  planned?: boolean;
}) {
  const theme = useTheme();
  return (
    <View style={styles.day}>
      <View style={styles.dayHeader}>
        <Text variant="labelLarge" style={[styles.dayLabel, { color: theme.colors.onSurfaceVariant }]}>
          {formatDay(section.date)}
        </Text>
        {planned && <StatusBadge status="planned" />}
      </View>
      <SectionCard dashed={planned}>
        {section.data.map((t) => (
          <TransactionRow key={t.id} transaction={t} accounts={accounts} categories={categories} />
        ))}
      </SectionCard>
    </View>
  );
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

  const listSource = searching ? (searchResults.data ?? []) : (transactions.data ?? []);
  const ready =
    (searching ? searchFilter === null || searchResults.data : transactions.data) && accounts.data && categories.data;
  const filtered = searching ? listSource : filterByCategory(listSource, categoryFilter, categories.data ?? []);
  const totals = monthTotals(filtered);
  // 一覧は新しい日付順なので、未来の予定が上に来る。予定は上にまとめ、開いたときは今日以前から見せる
  const today = toTokyoDateString();
  const sections = groupByDate(filtered);
  const future = sections.filter((section) => section.date > today);
  const past = sections.filter((section) => section.date <= today);

  const listRef = useRef<FlatList<DaySection>>(null);
  // 月や検索語が変わったときだけ予定の下まで送る（引っぱって更新したときなどは動かさない）
  const viewKey = searching ? `search:${term}` : `${month}:${categoryFilter ?? ''}`;
  const skippedFor = useRef<string | null>(null);
  const skipFuture = (futureHeight: number) => {
    // 全部が予定の月（来月など）はいちばん上から見せる
    if (skippedFor.current === viewKey || past.length === 0) return;
    skippedFor.current = viewKey;
    requestAnimationFrame(() =>
      listRef.current?.scrollToOffset({ offset: futureHeight + SPACING.screen, animated: false }),
    );
  };

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
        <QueryState
          isLoading={!(transactions.error ?? searchResults.error ?? accounts.error ?? categories.error)}
          error={transactions.error ?? searchResults.error ?? accounts.error ?? categories.error}
          onRetry={() => {
            if (searching) searchResults.refetch();
            transactions.refetch();
            accounts.refetch();
            categories.refetch();
          }}
        />
      ) : (
        <FlatList
          ref={listRef}
          data={past}
          keyExtractor={(section) => section.date}
          renderItem={({ item }) => <DayCard section={item} accounts={accounts.data!} categories={categories.data!} />}
          ListHeaderComponent={
            future.length > 0 ? (
              <View style={styles.future} onLayout={(e) => skipFuture(e.nativeEvent.layout.height)}>
                {future.map((section) => (
                  <DayCard
                    key={section.date}
                    section={section}
                    accounts={accounts.data!}
                    categories={categories.data!}
                    planned
                  />
                ))}
              </View>
            ) : null
          }
          ListEmptyComponent={
            future.length > 0 ? null : (
              <Text style={[styles.empty, { color: theme.colors.onSurfaceVariant }]} variant="bodyMedium">
                {searching ? (term === '' ? '' : '一致する記録はありません') : 'この月の記録はありません'}
              </Text>
            )
          }
          contentContainerStyle={styles.listContent}
          refreshControl={<RefreshControl refreshing={transactions.isRefetching} onRefresh={transactions.refetch} />}
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
  subtitle: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  subtitleText: { flexShrink: 1 },
  amount: { fontWeight: '700' },
  day: { gap: 6 },
  dayHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  future: { gap: 16, marginBottom: 16 },
  dayLabel: { paddingHorizontal: 4, fontWeight: '700' },
  empty: { padding: 32, textAlign: 'center' },
  listContent: { padding: SPACING.screen, gap: 16, paddingBottom: 96 },
});
