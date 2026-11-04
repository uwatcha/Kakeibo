import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { Text, useTheme } from 'react-native-paper';

import { SectionCard } from '@/components/SectionCard';
import type { Category } from '@/features/categories/api';
import { useEmployers } from '@/features/employers/hooks';
import { payPeriodForMonth } from '@/features/employers/payday';
import { useTransactionsBetween } from '@/features/transactions/hooks';
import { touchesAccounts } from '@/features/transactions/scope';
import { addDays, addMonths, formatDay } from '@/lib/date';
import { formatSignedYen, formatYen } from '@/lib/money';
import { SPACING } from '@/theme';

import { computeMealStats, MEALS_PER_DAY } from '../meals';

/** 選んだ月の給料日の期間（前の給料日〜その月の給料日の前日）。収入元がなければその月。今日より先は数えない */
function mealPeriod(employers: Parameters<typeof payPeriodForMonth>[0], month: string, today: string) {
  const period = payPeriodForMonth(employers, month);
  const from = period ? period.start.date : month;
  const end = period ? addDays(period.end.date, -1) : addDays(addMonths(month, 1), -1);
  return { from, end, through: end < today ? end : today };
}

function Row({ label, formula, children }: { label: string; formula: string; children: ReactNode }) {
  const theme = useTheme();
  return (
    <View style={styles.row}>
      <View style={styles.rowLine}>
        <Text variant="bodyLarge" style={styles.label}>
          {label}
        </Text>
        {children}
      </View>
      <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
        {formula}
      </Text>
    </View>
  );
}

/**
 * 集計の食費のカード（REQ-23 1食の平均・1日あたりの間食、REQ-22 外食で自炊より多く使った額。2026-11-04 ユーザーの指定）。
 * 期間は給料日から。実質残高に含める口座が関わる記録だけで数える（集計のほかのカードと同じ）
 */
export function MealCard({
  month,
  today,
  categories,
  accountIds,
}: {
  month: string;
  today: string;
  categories: readonly Category[];
  accountIds: ReadonlySet<string>;
}) {
  const theme = useTheme();
  const employers = useEmployers();
  const active = employers.data?.filter((e) => !e.is_archived) ?? [];
  const period = employers.data ? mealPeriod(active, month, today) : null;
  const transactions = useTransactionsBetween(period?.from, period?.through);

  if (!period || period.from > today) return null;
  const title = `食費（${formatDay(period.from)}〜${formatDay(period.end)}）`;
  if (!transactions.data) {
    return (
      <SectionCard title={title}>
        <Text variant="bodyMedium" style={[styles.state, { color: theme.colors.onSurfaceVariant }]}>
          {transactions.error ? '読み込めませんでした' : '読み込み中'}
        </Text>
      </SectionCard>
    );
  }

  const stats = computeMealStats(
    transactions.data.filter((t) => touchesAccounts(t, accountIds)),
    categories,
    period.from,
    period.through,
  );
  const { eatingOut, homePerMeal } = stats;
  return (
    <SectionCard title={title}>
      <Row
        label="1食の平均"
        formula={`食費 ${formatYen(stats.mealTotal)} ÷ ${stats.meals}食（${stats.days}日 × ${MEALS_PER_DAY}食）`}
      >
        <Text variant="titleMedium" style={styles.value}>
          {formatYen(stats.perMeal)}
        </Text>
      </Row>
      <Row label="1日あたりの間食" formula={`間食 ${formatYen(stats.snackTotal)} ÷ ${stats.days}日`}>
        <Text variant="titleMedium" style={styles.value}>
          {formatYen(stats.snackPerDay)}
        </Text>
      </Row>
      <Row
        label="自炊の1食"
        formula={`食料品 ${formatYen(stats.groceries)} ÷ ${Math.max(stats.homeMeals, 0)}食（${stats.meals}食 − 外食・中食 ${stats.boughtMeals}回）`}
      >
        <Text variant="titleMedium" style={styles.value}>
          {homePerMeal === null ? '―' : formatYen(homePerMeal)}
        </Text>
      </Row>
      <Row
        label="外食で自炊より多く使った額"
        formula={
          homePerMeal === null
            ? `外食 ${eatingOut.count}回 ${formatYen(eatingOut.total)}`
            : `外食 ${eatingOut.count}回 ${formatYen(eatingOut.total)} − 自炊の1食 ${formatYen(homePerMeal)} × ${eatingOut.count}回`
        }
      >
        {/* 多く使ったほど良くないので、プラスを赤で出す */}
        <Text
          variant="titleMedium"
          style={[styles.value, (eatingOut.overHome ?? 0) > 0 && { color: theme.colors.error }]}
        >
          {eatingOut.overHome === null ? '―' : formatSignedYen(eatingOut.overHome)}
        </Text>
      </Row>
    </SectionCard>
  );
}

const styles = StyleSheet.create({
  row: { paddingHorizontal: SPACING.row, paddingVertical: 8, gap: 2 },
  rowLine: { flexDirection: 'row', alignItems: 'baseline', gap: 8 },
  label: { flex: 1 },
  value: { fontWeight: '700', fontVariant: ['tabular-nums'] },
  state: { paddingHorizontal: SPACING.row, paddingBottom: 12 },
});
