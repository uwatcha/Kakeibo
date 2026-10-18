import { router } from 'expo-router';
import { useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { PieChart } from 'react-native-gifted-charts';
import { Card, IconButton, List, ProgressBar, Text, useTheme } from 'react-native-paper';

import { Carousel } from '@/components/Carousel';
import { QueryState } from '@/components/QueryState';
import { useCategories } from '@/features/categories/hooks';
import { buildBreakdown, type Comparison, compare, toDonutSlices } from '@/features/reports/breakdown';
import { useCategoryExpense, useMonthComparison } from '@/features/reports/hooks';
import { SincePaydayChart } from '@/features/reports/components/SincePaydayChart';
import { sliceColor } from '@/features/reports/palette';
import { addMonths, formatMonth, monthStart, toTokyoDateString } from '@/lib/date';
import { formatYen } from '@/lib/money';

function formatRate(rate: number | null): string {
  if (rate === null) return '';
  const percent = Math.round(rate * 100);
  return `（${percent > 0 ? '+' : ''}${percent}%）`;
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
      <Text variant="titleMedium" style={styles.number} numberOfLines={1} adjustsFontSizeToFit>
        {signed && current > 0 ? '+' : ''}
        {formatYen(current)}
      </Text>
      <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
        前月比 {diff > 0 ? '+' : ''}
        {formatYen(diff)}
        {formatRate(rate)}
      </Text>
    </View>
  );
}

export default function ReportsScreen() {
  const theme = useTheme();
  const [month, setMonth] = useState(() => monthStart(toTokyoDateString()));
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const totals = useMonthComparison(month);
  const expense = useCategoryExpense(month);
  const categories = useCategories();

  const changeMonth = (delta: number) => {
    setMonth(addMonths(month, delta));
    setSelectedKey(null);
  };

  const refetch = () => {
    totals.refetch();
    expense.refetch();
    categories.refetch();
  };

  const header = (
    <View style={styles.monthBar}>
      <IconButton icon="chevron-left" accessibilityLabel="前の月" onPress={() => changeMonth(-1)} />
      <Text variant="titleMedium">{formatMonth(month)}</Text>
      <IconButton icon="chevron-right" accessibilityLabel="次の月" onPress={() => changeMonth(1)} />
    </View>
  );

  if (!totals.data || !expense.data || !categories.data) {
    const error = totals.error ?? expense.error ?? categories.error;
    return (
      <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
        {header}
        <QueryState isLoading={!error} error={error} onRetry={refetch} />
      </View>
    );
  }

  const { current, previous } = totals.data;
  const items = buildBreakdown(expense.data, categories.data);
  const slices = toDonutSlices(items);
  const selected = slices.find((s) => s.key === selectedKey);
  const surface = theme.colors.elevation.level1;

  const openTransactions = (categoryId: string | null) =>
    router.navigate({ pathname: '/transactions', params: { month, categoryId: categoryId ?? 'none' } });

  return (
    <ScrollView
      style={{ backgroundColor: theme.colors.background }}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={totals.isRefetching || expense.isRefetching} onRefresh={refetch} />}
    >
      {header}

      <Card mode="contained">
        <Card.Content style={styles.tiles}>
          <StatTile label="収入" comparison={compare(current.income, previous.income)} />
          <StatTile label="支出" comparison={compare(current.expense, previous.expense)} />
          <StatTile
            label="差額"
            comparison={compare(current.income - current.expense, previous.income - previous.expense)}
            signed
          />
        </Card.Content>
      </Card>

      {/* グラフは横スワイプで切り替える。カードは高い方に高さをそろえる */}
      <Carousel
        pages={[
          {
            key: 'breakdown',
            label: '大分類別の支出',
            content: (
              <Card mode="contained" style={styles.page}>
                <Card.Title title="大分類別の支出" subtitle={formatMonth(month)} />
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
                            {formatYen(selected ? selected.amount : current.expense)}
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
            content: <SincePaydayChart today={toTokyoDateString()} style={styles.page} />,
          },
        ]}
      />

      {items.length > 0 && (
        <Card mode="contained">
          <Card.Title title="カテゴリ別の支出" />
          {/* ドーナツの凡例を兼ねる。色だけに頼らず名前・金額・割合を出す */}
          {items.map((item, index) => {
            const color = index < 5 ? sliceColor(index, false, theme.dark) : sliceColor(0, true, theme.dark);
            return (
              <List.Item
                key={item.categoryId ?? 'uncategorized'}
                title={item.name}
                titleStyle={styles.itemTitle}
                description={() => <ProgressBar progress={item.ratio} color={color} style={styles.bar} />}
                left={() => <View style={[styles.swatch, { backgroundColor: color }]} />}
                right={() => (
                  <View style={styles.itemRight}>
                    <Text style={styles.number}>{formatYen(item.amount)}</Text>
                    <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
                      {Math.round(item.ratio * 100)}%
                    </Text>
                  </View>
                )}
                onPress={() => openTransactions(item.categoryId)}
              />
            );
          })}
        </Card>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 16, gap: 12, paddingBottom: 32 },
  monthBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  tiles: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  tile: { flex: 1, gap: 2 },
  number: { fontVariant: ['tabular-nums'] },
  page: { flex: 1 },
  chart: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 8 },
  center: { alignItems: 'center', maxWidth: 110 },
  swatch: { width: 12, height: 12, borderRadius: 3, alignSelf: 'center', marginLeft: 8 },
  itemTitle: { marginBottom: 4 },
  bar: { height: 6, borderRadius: 3 },
  itemRight: { alignItems: 'flex-end', justifyContent: 'center' },
});
