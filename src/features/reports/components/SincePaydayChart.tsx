import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { LineChart } from 'react-native-gifted-charts';
import { ActivityIndicator, Button, Card, Text, useTheme } from 'react-native-paper';

import { useAccountBalances } from '@/features/accounts/hooks';
import { isAvailableAccount, summarizeBalances } from '@/features/accounts/summary';
import { useEmployers } from '@/features/employers/hooks';
import { lastPayday, nextPayday } from '@/features/employers/payday';
import { dailyBalances } from '@/features/reports/balanceSeries';
import { useMovementsAfter } from '@/features/reports/hooks';
import { SLICE_COLORS } from '@/features/reports/palette';
import { formatDay } from '@/lib/date';
import { formatYen } from '@/lib/money';

const Y_AXIS_WIDTH = 44;
const CHART_HEIGHT = 180;

/** 軸の目盛り用（25万、3.5万、8,000） */
function compactYen(value: number): string {
  if (Math.abs(value) >= 10000) {
    const man = value / 10000;
    return `${Number.isInteger(man) ? man : man.toFixed(1)}万`;
  }
  return value.toLocaleString('ja-JP');
}

const shortDate = (date: string) => `${Number(date.slice(5, 7))}/${Number(date.slice(8, 10))}`;

/** 前回の給料日から今日までの汎用資産の推移 */
export function SincePaydayChart({ today }: { today: string }) {
  const theme = useTheme();
  const [width, setWidth] = useState(0);
  const employers = useEmployers();
  const balances = useAccountBalances();

  const active = employers.data?.filter((e) => !e.is_archived) ?? [];
  const last = lastPayday(active, today);
  const next = nextPayday(active, today);
  const movements = useMovementsAfter(last?.date);

  if (employers.data && active.length === 0) {
    return (
      <Card mode="contained">
        <Card.Title title="前回の給料日からの推移" />
        <Card.Content style={styles.gap}>
          <Text variant="bodyMedium">働き先と給料日を登録すると、給料日から今日までの汎用資産の動きが出ます。</Text>
          <Button mode="outlined" icon="briefcase-plus" onPress={() => router.push('/employers')}>
            働き先と給料日を登録
          </Button>
        </Card.Content>
      </Card>
    );
  }

  const ready = employers.data && balances.data && movements.data && last;
  if (!ready) {
    return (
      <Card mode="contained">
        <Card.Title title="前回の給料日からの推移" />
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

  const accounts = balances.data!;
  const targets = new Set(accounts.filter(isAvailableAccount).map((a) => a.id));
  const points = dailyBalances(
    summarizeBalances(accounts).availableNetWorth,
    movements.data!,
    (id) => targets.has(id),
    last.date,
    today,
  );
  const sinceToday = movements.data!.filter((m) => m.date <= today);
  const income = sinceToday.filter((m) => m.type === 'income').reduce((s, m) => s + m.amount, 0);
  const expense = sinceToday.filter((m) => m.type === 'expense').reduce((s, m) => s + m.amount, 0);

  // 縦軸は期間の最小値の少し下から始める（0 からだと線が上に張り付いて動きが見えない）
  const values = points.map((p) => p.balance);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const margin = Math.max((max - min) * 0.15, 1000);
  const base = Math.floor((min - margin) / 1000) * 1000;
  const top = Math.ceil((max + margin - base) / 1000) * 1000;

  const labelEvery = Math.max(1, Math.ceil(points.length / 5));
  const color = theme.dark ? SLICE_COLORS.dark[0] : SLICE_COLORS.light[0];
  const plotWidth = Math.max(0, width - Y_AXIS_WIDTH - 24);
  const spacing = points.length > 1 ? plotWidth / (points.length - 1) : plotWidth;
  const muted = { color: theme.colors.onSurfaceVariant, fontSize: 10 };

  return (
    <Card mode="contained">
      <Card.Title
        title="前回の給料日からの推移"
        subtitle={`${formatDay(last.date)}（${last.employer.name}）から今日まで・汎用資産`}
      />
      <Card.Content style={styles.gap}>
        <View style={styles.summary}>
          <Text variant="bodyMedium">収入 {formatYen(income)}</Text>
          <Text variant="bodyMedium">支出 {formatYen(expense)}</Text>
          <Text variant="bodyMedium" style={styles.bold}>
            今 {formatYen(points[points.length - 1].balance)}
          </Text>
        </View>

        <View onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
          {width > 0 && points.length > 1 ? (
            <LineChart
              data={points.map((p, i) => ({
                value: p.balance - base,
                label: i === points.length - 1 ? '今日' : i % labelEvery === 0 ? shortDate(p.date) : '',
                hideDataPoint: i !== points.length - 1,
              }))}
              height={CHART_HEIGHT}
              width={plotWidth}
              spacing={spacing}
              initialSpacing={4}
              endSpacing={4}
              maxValue={top}
              noOfSections={4}
              formatYLabel={(label: string) => compactYen(Number(label) + base)}
              yAxisLabelWidth={Y_AXIS_WIDTH}
              yAxisTextStyle={muted}
              xAxisLabelTextStyle={[muted, styles.xLabel]}
              yAxisColor="transparent"
              xAxisColor={theme.colors.outlineVariant}
              rulesColor={theme.colors.outlineVariant}
              rulesType="solid"
              color={color}
              thickness={2}
              dataPointsColor={color}
              dataPointsRadius={4}
              areaChart
              startFillColor={color}
              endFillColor={color}
              startOpacity={0.18}
              endOpacity={0.02}
              pointerConfig={{
                pointerStripColor: theme.colors.outline,
                pointerStripWidth: 1,
                pointerColor: color,
                radius: 5,
                pointerLabelWidth: 120,
                pointerLabelHeight: 48,
                autoAdjustPointerLabelPosition: true,
                pointerLabelComponent: (items: { value: number }[], _s: unknown, index: number) => (
                  <View style={[styles.tooltip, { backgroundColor: theme.colors.inverseSurface }]}>
                    <Text variant="labelSmall" style={{ color: theme.colors.inverseOnSurface }}>
                      {formatDay(points[index]?.date ?? today)}
                    </Text>
                    <Text variant="labelLarge" style={{ color: theme.colors.inverseOnSurface }}>
                      {formatYen(items[0].value + base)}
                    </Text>
                  </View>
                ),
              }}
            />
          ) : (
            points.length <= 1 && <Text variant="bodySmall">今日が給料日です。明日から推移が出ます。</Text>
          )}
        </View>

        {next && (
          <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
            次の給料日: {formatDay(next.date)}（{next.employer.name}）
          </Text>
        )}
      </Card.Content>
    </Card>
  );
}

const styles = StyleSheet.create({
  gap: { gap: 8 },
  summary: { flexDirection: 'row', justifyContent: 'space-between' },
  bold: { fontWeight: 'bold' },
  xLabel: { width: 40, marginLeft: -12 },
  tooltip: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4 },
});
