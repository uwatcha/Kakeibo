import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, type StyleProp, StyleSheet, View, type ViewStyle } from 'react-native';
import { ActivityIndicator, Button, Card, Text } from 'react-native-paper';

import { Amount } from '@/components/Amount';
import { useAccountBalances } from '@/features/accounts/hooks';
import { isAvailableAccount, summarizeBalances } from '@/features/accounts/summary';
import { useEmployers } from '@/features/employers/hooks';
import { payPeriodForMonth } from '@/features/employers/payday';
import { balancesWithPlans, projectUntil } from '@/features/reports/balanceSeries';
import { useMovementsAfter } from '@/features/reports/hooks';
import { formatDay } from '@/lib/date';
import { formatYen } from '@/lib/money';
import { RADIUS } from '@/theme';

import { BalanceLineChart, LineSwatch, shortDate, useLineColor } from './BalanceLineChart';

const CHART_HEIGHT = 180;
const TITLE = '給料日からの推移';

/**
 * 【以前止めた機能。不要なら消す（CLAUDE.md「止めている機能」）】
 * true にすると、今日までのペースが続いた場合の予測の線（projectUntil）も重ねて出す
 */
const SHOW_PACE_PROJECTION = false;

/**
 * 選んだ月の給料日の期間（前の給料日〜その月の給料日）の実質残高の推移。
 * 今日より後の予定も入れ、今日までは実線・それより後は点線。押すと横向きで全期間のグラフを開く
 */
export function SincePaydayChart({
  month,
  today,
  style,
}: {
  month: string;
  today: string;
  style?: StyleProp<ViewStyle>;
}) {
  const color = useLineColor();
  const [width, setWidth] = useState(0);
  const employers = useEmployers();
  const balances = useAccountBalances();

  const active = employers.data?.filter((e) => !e.is_archived) ?? [];
  const period = payPeriodForMonth(active, month);
  const from = period ? (period.start.date < today ? period.start.date : today) : undefined;
  const movements = useMovementsAfter(from);

  if (employers.data && active.length === 0) {
    return (
      <Card mode="elevated" elevation={1} style={[styles.card, style]}>
        <Card.Title title={TITLE} titleStyle={styles.title} />
        <Card.Content style={styles.gap}>
          <Button mode="outlined" icon="briefcase-plus" onPress={() => router.push('/employers')}>
            収入元と入金日を登録
          </Button>
        </Card.Content>
      </Card>
    );
  }

  if (!employers.data || !balances.data || !movements.data || !period) {
    return (
      <Card mode="elevated" elevation={1} style={[styles.card, style]}>
        <Card.Title title={TITLE} titleStyle={styles.title} />
        <Card.Content>
          {employers.error || balances.error || movements.error ? (
            <Text variant="bodyMedium">読み込めませんでした</Text>
          ) : (
            <ActivityIndicator />
          )}
        </Card.Content>
      </Card>
    );
  }

  const targets = new Set(balances.data.filter(isAvailableAccount).map((a) => a.id));
  const isTarget = (id: string) => targets.has(id);
  const { start, end } = period;
  const points = balancesWithPlans(
    summarizeBalances(balances.data).availableNetWorth,
    movements.data,
    isTarget,
    today,
    start.date,
    end.date,
  );
  const inPeriod = movements.data.filter((m) => m.date > start.date && m.date <= end.date);
  const income = inPeriod.filter((m) => m.type === 'income').reduce((s, m) => s + m.amount, 0);
  const expense = inPeriod.filter((m) => m.type === 'expense').reduce((s, m) => s + m.amount, 0);
  const todayIndex = points.findLastIndex((p) => p.date <= today);
  const hasPlanned = todayIndex < points.length - 1;

  const projection =
    SHOW_PACE_PROJECTION && todayIndex > 0 && hasPlanned
      ? projectUntil(points.slice(0, todayIndex + 1), end.date)
      : null;

  // 右上の額: 期間に今日が入っていれば今の残高、そうでなければ給料日の前日の残高
  const todayInPeriod = today >= start.date && today <= end.date;
  const summaryPoint = todayInPeriod
    ? { label: '今', balance: points[todayIndex].balance }
    : { label: '給料日の前日', balance: points[Math.max(0, points.length - 2)].balance };

  // 目盛りは 前の給料日・今日・その月の給料日 の3つ。近すぎて重なるものは出さない
  const lastIndex = points.length - 1;
  const minGap = Math.max(2, Math.ceil(points.length * 0.18));
  const labelFor = (i: number) => {
    if (i === 0) return shortDate(points[0].date);
    if (i === lastIndex) return lastIndex - Math.max(todayIndex, 0) >= minGap || todayIndex < 0 ? '給料日' : '';
    if (i === todayIndex && todayIndex >= minGap && lastIndex - todayIndex >= minGap) return '今日';
    return '';
  };

  return (
    <Card mode="elevated" elevation={1} style={[styles.card, style]}>
      <Card.Title
        title={TITLE}
        titleStyle={styles.title}
        subtitle={`${formatDay(start.date)}〜${formatDay(end.date)}（${end.employer.name}）・実質残高の口座`}
      />
      <Card.Content style={styles.gap}>
        <View style={styles.summary}>
          <Text variant="bodyMedium">収入 {formatYen(income)}</Text>
          <Text variant="bodyMedium">支出 {formatYen(expense)}</Text>
          <View style={styles.inline}>
            <Text variant="bodyMedium" style={styles.bold}>
              {summaryPoint.label}{' '}
            </Text>
            <Amount value={summaryPoint.balance} variant="bodyMedium" style={styles.bold} />
          </View>
        </View>

        <Pressable
          onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
          onPress={() => router.push('/balance-chart')}
          accessibilityRole="button"
          accessibilityLabel="全期間の推移を横向きで開く"
        >
          {width > 0 && (
            <BalanceLineChart
              points={points}
              today={today}
              width={width}
              height={CHART_HEIGHT}
              labelFor={labelFor}
              projection={projection}
            />
          )}
        </Pressable>

        {hasPlanned && (
          <View style={styles.legend}>
            <View style={styles.legendItem}>
              <LineSwatch color={color} />
              <Text variant="bodySmall">実績</Text>
            </View>
            <View style={styles.legendItem}>
              <LineSwatch color={color} dashed />
              <Text variant="bodySmall">予定</Text>
            </View>
          </View>
        )}
      </Card.Content>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: RADIUS.card },
  title: { fontWeight: '700' },
  gap: { gap: 8 },
  summary: { flexDirection: 'row', justifyContent: 'space-between' },
  bold: { fontWeight: 'bold' },
  inline: { flexDirection: 'row', alignItems: 'baseline' },
  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: 16 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
});
