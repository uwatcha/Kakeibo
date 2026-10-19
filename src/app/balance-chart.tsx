import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import { ActivityIndicator, IconButton, Text, useTheme } from 'react-native-paper';

import { Amount } from '@/components/Amount';
import { useAccountBalances } from '@/features/accounts/hooks';
import { isAvailableAccount, summarizeBalances } from '@/features/accounts/summary';
import { balancesWithPlans } from '@/features/reports/balanceSeries';
import { BalanceLineChart, LineSwatch, useLineColor } from '@/features/reports/components/BalanceLineChart';
import { useMovementsAfter } from '@/features/reports/hooks';
import { addDays, formatDay, toTokyoDateString } from '@/lib/date';

/** すべての記録を取るための、どの記録よりも前の日付 */
const BEGINNING = '1900-01-01';
const HEADER_HEIGHT = 48;
const PADDING = 16;
/** 横軸の目盛りは多くてもこの数まで（月の初めに付ける） */
const MAX_LABELS = 8;

/**
 * 汎用資産の全期間の推移を横向きで出す。端末の向きは変えず、画面全体を90度回して横長に見せる
 * （向きを変える部品は APK の作り直しが要るため）
 */
export default function BalanceChartScreen() {
  const theme = useTheme();
  const color = useLineColor();
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const balances = useAccountBalances();
  const movements = useMovementsAfter(BEGINNING);
  const today = toTokyoDateString();

  // 回したあとの横幅は画面の高さ、高さは画面の幅
  const width = screenHeight;
  const height = screenWidth;

  let body = <ActivityIndicator />;
  if (balances.error || movements.error) {
    body = <Text variant="bodyMedium">読み込めませんでした</Text>;
  } else if (balances.data && movements.data) {
    const targets = new Set(balances.data.filter(isAvailableAccount).map((a) => a.id));
    const dates = movements.data.map((m) => m.date).sort();
    // 最初の記録の前日（使い始めの残高）から、今日か最後の予定のどちらか遅い日まで
    const start = dates.length > 0 ? addDays(dates[0], -1) : addDays(today, -1);
    const lastDate = dates.at(-1);
    const end = lastDate && lastDate > today ? lastDate : today;
    const points = balancesWithPlans(
      summarizeBalances(balances.data).availableNetWorth,
      movements.data,
      (id) => targets.has(id),
      today,
      start,
      end,
    );
    const monthStarts = points.map((p, i) => (p.date.endsWith('-01') ? i : -1)).filter((i) => i >= 0);
    const step = Math.max(1, Math.ceil(monthStarts.length / MAX_LABELS));
    const labelFor = (i: number) => {
      if (i === 0) return `${Number(points[0].date.slice(5, 7))}/${Number(points[0].date.slice(8, 10))}`;
      const k = monthStarts.indexOf(i);
      return k >= 0 && k % step === 0 ? `${Number(points[i].date.slice(5, 7))}月` : '';
    };
    const todayPoint = points.findLast((p) => p.date <= today);

    body = (
      <>
        <View style={styles.legend}>
          <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
            {formatDay(start)}〜{formatDay(end)}
          </Text>
          <View style={styles.legendItem}>
            <LineSwatch color={color} />
            <Text variant="bodySmall">実績</Text>
          </View>
          <View style={styles.legendItem}>
            <LineSwatch color={color} dashed />
            <Text variant="bodySmall">予定</Text>
          </View>
          {todayPoint && (
            <View style={styles.legendItem}>
              <Text variant="bodySmall">今</Text>
              <Amount value={todayPoint.balance} variant="bodySmall" style={styles.bold} />
            </View>
          )}
        </View>
        <BalanceLineChart
          points={points}
          today={today}
          width={width - PADDING * 2}
          height={height - HEADER_HEIGHT - PADDING * 2 - 56}
          labelFor={labelFor}
        />
      </>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <StatusBar hidden />
      <View
        style={[
          styles.rotated,
          {
            width,
            height,
            left: (screenWidth - width) / 2,
            top: (screenHeight - height) / 2,
            backgroundColor: theme.colors.surface,
          },
        ]}
      >
        <View style={styles.header}>
          <Text variant="titleMedium" style={styles.bold}>
            汎用資産の推移（全期間）
          </Text>
          <IconButton icon="close" accessibilityLabel="閉じる" onPress={() => router.back()} />
        </View>
        {body}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  rotated: {
    position: 'absolute',
    transform: [{ rotate: '90deg' }],
    paddingHorizontal: PADDING,
    paddingBottom: PADDING,
  },
  header: { height: HEADER_HEIGHT, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  bold: { fontWeight: '700' },
  legend: { flexDirection: 'row', alignItems: 'center', gap: 16, paddingBottom: 8 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
});
