import { router } from 'expo-router';
import { useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { PieChart } from 'react-native-gifted-charts';
import { Card, IconButton, ProgressBar, Text, TouchableRipple, useTheme } from 'react-native-paper';

import { Amount } from '@/components/Amount';
import { Carousel } from '@/components/Carousel';
import { QueryState } from '@/components/QueryState';
import { SectionCard } from '@/components/SectionCard';
import { useAvailableAccountIds } from '@/features/accounts/hooks';
import { useCategories } from '@/features/categories/hooks';
import { buildBreakdown, type Comparison, compare, toDonutSlices } from '@/features/reports/breakdown';
import { SincePaydayChart } from '@/features/reports/components/SincePaydayChart';
import { sliceColor } from '@/features/reports/palette';
import type { Transaction } from '@/features/transactions/api';
import { useMonthTransactions } from '@/features/transactions/hooks';
import { monthTotals } from '@/features/transactions/list';
import { categoryExpenseRows, touchesAccounts } from '@/features/transactions/scope';
import { addMonths, formatMonth, monthStart, toTokyoDateString } from '@/lib/date';
import { formatSignedYen, formatYen, MINUS } from '@/lib/money';
import { RADIUS, SPACING } from '@/theme';

function formatRate(rate: number | null): string {
  if (rate === null) return '';
  const percent = Math.round(rate * 100);
  return `（${percent > 0 ? '+' : percent < 0 ? MINUS : ''}${Math.abs(percent)}%）`;
}

/** 収入・支出・差額と前月比のタイル */
function StatTile({ label, comparison, signed = false }: { label: string; comparison: Comparison; signed?: boolean }) {
  const theme = useTheme();
  const { current, diff, rate } = comparison;
  return (
    <View style={styles.tile}>
      <Text variant="labelMedium" style={{ color: theme.colors.onSurfaceVariant }}>
        {label}
      </Text>
      {signed ? (
        <Amount
          value={current}
          kind="delta"
          variant="titleMedium"
          style={styles.tileAmount}
          numberOfLines={1}
          adjustsFontSizeToFit
        />
      ) : (
        <Text variant="titleMedium" style={[styles.number, styles.tileAmount]} numberOfLines={1} adjustsFontSizeToFit>
          {formatYen(current)}
        </Text>
      )}
      <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
        前月比 {formatSignedYen(diff)}
        {formatRate(rate)}
      </Text>
    </View>
  );
}

export default function ReportsScreen() {
  const theme = useTheme();
  const [month, setMonth] = useState(() => monthStart(toTokyoDateString()));
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  // 汎用資産に含める口座（右上のパネルで選ぶ）が関わる記録だけで集計する
  const current = useMonthTransactions(month);
  const previousMonth = useMonthTransactions(addMonths(month, -1));
  const availableIds = useAvailableAccountIds();
  const categories = useCategories();

  const changeMonth = (delta: number) => {
    setMonth(addMonths(month, delta));
    setSelectedKey(null);
  };

  const refetch = () => {
    current.refetch();
    previousMonth.refetch();
    categories.refetch();
  };

  const header = (
    <View style={styles.monthBar}>
      <IconButton icon="chevron-left" accessibilityLabel="前の月" onPress={() => changeMonth(-1)} />
      <Text variant="titleMedium" style={styles.month}>
        {formatMonth(month)}
      </Text>
      <IconButton icon="chevron-right" accessibilityLabel="次の月" onPress={() => changeMonth(1)} />
    </View>
  );

  if (!current.data || !previousMonth.data || !availableIds || !categories.data) {
    const error = current.error ?? previousMonth.error ?? categories.error;
    return (
      <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
        {header}
        <QueryState isLoading={!error} error={error} onRetry={refetch} />
      </View>
    );
  }

  const inScope = (list: readonly Transaction[]) => list.filter((t) => touchesAccounts(t, availableIds));
  const currentScoped = inScope(current.data);
  const thisMonth = monthTotals(currentScoped);
  const lastMonth = monthTotals(inScope(previousMonth.data));
  const items = buildBreakdown(categoryExpenseRows(currentScoped, categories.data), categories.data);
  const slices = toDonutSlices(items);
  const selected = slices.find((s) => s.key === selectedKey);
  const surface = theme.colors.elevation.level1;

  const openTransactions = (categoryId: string | null) =>
    router.navigate({ pathname: '/transactions', params: { month, categoryId: categoryId ?? 'none' } });

  return (
    <ScrollView
      style={{ backgroundColor: theme.colors.background }}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl refreshing={current.isRefetching || previousMonth.isRefetching} onRefresh={refetch} />
      }
    >
      {header}

      <SectionCard style={styles.tilesCard}>
        <View style={styles.tiles}>
          <StatTile label="収入" comparison={compare(thisMonth.income, lastMonth.income)} />
          <StatTile label="支出" comparison={compare(thisMonth.expense, lastMonth.expense)} />
          <StatTile
            label="差額"
            comparison={compare(thisMonth.income - thisMonth.expense, lastMonth.income - lastMonth.expense)}
            signed
          />
        </View>
      </SectionCard>

      {/* グラフは横スワイプで切り替える。カードは高い方に高さをそろえる */}
      <Carousel
        pages={[
          {
            key: 'breakdown',
            label: '大分類別の支出',
            content: (
              <Card mode="elevated" elevation={1} style={[styles.card, styles.page]}>
                <Card.Title title="大分類別の支出" titleStyle={styles.bold} subtitle={formatMonth(month)} />
                {items.length === 0 ? (
                  <Card.Content>
                    <Text variant="bodyMedium">この月の支出はありません</Text>
                  </Card.Content>
                ) : (
                  <View style={styles.chart}>
                    <PieChart
                      data={slices.map((s, i) => ({
                        value: s.amount,
                        color: sliceColor(i, s.isOther, theme.dark),
                        focused: s.key === selectedKey,
                        onPress: () => setSelectedKey(s.key === selectedKey ? null : s.key),
                      }))}
                      donut
                      radius={96}
                      innerRadius={64}
                      innerCircleColor={surface}
                      strokeColor={surface}
                      strokeWidth={2}
                      centerLabelComponent={() => (
                        <View style={styles.center}>
                          <Text variant="labelMedium" numberOfLines={1}>
                            {selected ? selected.name : '合計'}
                          </Text>
                          <Text variant="titleMedium" style={styles.number}>
                            {formatYen(selected ? selected.amount : thisMonth.expense)}
                          </Text>
                          {selected && <Text variant="bodySmall">{Math.round(selected.ratio * 100)}%</Text>}
                        </View>
                      )}
                    />
                  </View>
                )}
              </Card>
            ),
          },
          {
            key: 'since-payday',
            label: '給料日からの推移',
            content: <SincePaydayChart month={month} today={toTokyoDateString()} style={styles.page} />,
          },
        ]}
      />

      {items.length > 0 && (
        <SectionCard title="カテゴリ別の支出">
          {/* ドーナツの凡例を兼ねる。色だけに頼らず名前と金額を出す */}
          {items.map((item, index) => {
            const color = index < 5 ? sliceColor(index, false, theme.dark) : sliceColor(0, true, theme.dark);
            return (
              <TouchableRipple
                key={item.categoryId ?? 'uncategorized'}
                onPress={() => openTransactions(item.categoryId)}
              >
                <View style={styles.categoryRow}>
                  <View style={[styles.swatch, { backgroundColor: color }]} />
                  <View style={styles.categoryBody}>
                    <View style={styles.categoryLine}>
                      <Text variant="bodyLarge" numberOfLines={1} style={styles.categoryName}>
                        {item.name}
                      </Text>
                      <Text variant="bodyLarge" style={[styles.number, styles.bold]}>
                        {formatYen(item.amount)}
                      </Text>
                    </View>
                    <ProgressBar progress={item.ratio} color={color} style={styles.bar} />
                  </View>
                </View>
              </TouchableRipple>
            );
          })}
        </SectionCard>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { paddingHorizontal: SPACING.screen, gap: SPACING.gap, paddingBottom: 32 },
  monthBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  month: { fontWeight: '700', minWidth: 96, textAlign: 'center' },
  card: { borderRadius: RADIUS.card },
  tilesCard: { paddingHorizontal: SPACING.row, paddingVertical: 14 },
  tiles: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  tile: { flex: 1, gap: 2 },
  tileAmount: { fontWeight: '700' },
  number: { fontVariant: ['tabular-nums'] },
  bold: { fontWeight: '700' },
  page: { flex: 1 },
  chart: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 8 },
  center: { alignItems: 'center', maxWidth: 110 },
  categoryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingHorizontal: SPACING.row,
    paddingVertical: 10,
  },
  swatch: { width: 12, height: 12, borderRadius: 4 },
  categoryBody: { flex: 1, gap: 6 },
  categoryLine: { flexDirection: 'row', alignItems: 'baseline', gap: 8 },
  categoryName: { flex: 1 },
  bar: { height: 6, borderRadius: 3 },
});
