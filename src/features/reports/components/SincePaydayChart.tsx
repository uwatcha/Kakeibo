import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { LineChart } from 'react-native-gifted-charts';
import { ActivityIndicator, Button, Card, Text, useTheme } from 'react-native-paper';

import { Amount } from '@/components/Amount';
import { useAccountBalances } from '@/features/accounts/hooks';
import { isAvailableAccount, summarizeBalances } from '@/features/accounts/summary';
import { useEmployers } from '@/features/employers/hooks';
import { lastPayday, nextPayday } from '@/features/employers/payday';
import { dailyBalances, projectUntil } from '@/features/reports/balanceSeries';
import { useMovementsAfter } from '@/features/reports/hooks';
import { SLICE_COLORS } from '@/features/reports/palette';
import { formatDay } from '@/lib/date';
import { formatYen } from '@/lib/money';

const Y_AXIS_WIDTH = 44;
const CHART_HEIGHT = 180;
const TITLE = '給料日からの推移';

/** 軸の目盛り用（25万、3.5万、8,000） */
function compactYen(value: number): string {
  if (Math.abs(value) >= 10000) {
    const man = value / 10000;
    return `${Number.isInteger(man) ? man : man.toFixed(1)}万`;
  }
  return value.toLocaleString('ja-JP');
}

const shortDate = (date: string) => `${Number(date.slice(5, 7))}/${Number(date.slice(8, 10))}`;

/** 凡例の線の見本 */
function LineSwatch({ color, dashed }: { color: string; dashed?: boolean }) {
  return (
    <View style={styles.swatch}>
      {dashed ? (
        [0, 1, 2].map((i) => <View key={i} style={[styles.dash, { backgroundColor: color }]} />)
      ) : (
        <View style={[styles.solid, { backgroundColor: color }]} />
      )}
    </View>
  );
}

/** 前回の給料日から次の給料日までの汎用資産。今日までは実績、その先はこのままの勢いでの予測（点線） */
export function SincePaydayChart({ today, style }: { today: string; style?: object }) {
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
      <Card mode="contained" style={style}>
        <Card.Title title={TITLE} />
        <Card.Content style={styles.gap}>
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
      <Card mode="contained" style={style}>
        <Card.Title title={TITLE} />
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
  const actual = dailyBalances(
    summarizeBalances(accounts).availableNetWorth,
    // 今の残高は今日までの記録で計算されているので、未来の日付の記録は差し戻さない
    movements.data!.filter((m) => m.date <= today),
    (id) => targets.has(id),
    last.date,
    today,
  );
  const projection = next ? projectUntil(actual, next.date) : null;
  const sinceToday = movements.data!.filter((m) => m.date <= today);
  const income = sinceToday.filter((m) => m.type === 'income').reduce((s, m) => s + m.amount, 0);
  const expense = sinceToday.filter((m) => m.type === 'expense').reduce((s, m) => s + m.amount, 0);

  // 横軸: 前回の給料日〜次の給料日。今日の点は実績と予測の両方に入る
  const todayIndex = actual.length - 1;
  const dates = [...actual.map((p) => p.date), ...(projection ?? []).slice(1).map((p) => p.date)];
  const lastIndex = dates.length - 1;
  const actualValues = dates.map((_, i) => actual[Math.min(i, todayIndex)].balance);
  const projectedValues = dates.map((_, i) => (projection ? projection[Math.max(0, i - todayIndex)].balance : 0));

  // 縦軸は期間の最小値の少し下から始める（0 からだと線が上に張り付いて動きが見えない）
  const values = [...actual.map((p) => p.balance), ...(projection ?? []).map((p) => p.balance)];
  const min = Math.min(...values);
  const max = Math.max(...values);
  const margin = Math.max((max - min) * 0.15, 1000);
  const base = Math.floor((min - margin) / 1000) * 1000;
  const top = Math.ceil((max + margin - base) / 1000) * 1000;

  // 目盛りは 前回の給料日・今日・次の給料日 の3つ。近すぎて重なるものは出さない
  const minGap = Math.max(2, Math.ceil(dates.length * 0.18));
  const labelFor = (i: number) => {
    if (i === 0) return shortDate(dates[0]);
    if (i === todayIndex && todayIndex >= minGap) return '今日';
    if (i === lastIndex && projection && lastIndex - todayIndex >= minGap) return '給料日';
    return '';
  };

  const color = theme.dark ? SLICE_COLORS.dark[0] : SLICE_COLORS.light[0];
  const plotWidth = Math.max(0, width - Y_AXIS_WIDTH - 24);
  const spacing = dates.length > 1 ? plotWidth / (dates.length - 1) : plotWidth;
  const muted = { color: theme.colors.onSurfaceVariant, fontSize: 10 };
  const projectedEnd = projection?.[projection.length - 1];

  return (
    <Card mode="contained" style={style}>
      <Card.Title title={TITLE} subtitle={`${formatDay(last.date)}（${last.employer.name}）から・汎用資産`} />
      <Card.Content style={styles.gap}>
        <View style={styles.summary}>
          <Text variant="bodyMedium">収入 {formatYen(income)}</Text>
          <Text variant="bodyMedium">支出 {formatYen(expense)}</Text>
          <View style={styles.inline}>
            <Text variant="bodyMedium" style={styles.bold}>
              今{' '}
            </Text>
            <Amount value={actual[todayIndex].balance} variant="bodyMedium" style={styles.bold} />
          </View>
        </View>

        <View onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
          {width > 0 && dates.length > 1 ? (
            <LineChart
              data={actualValues.map((v, i) => ({
                value: v - base,
                label: labelFor(i),
                hideDataPoint: i !== todayIndex,
              }))}
              endIndex1={todayIndex}
              data2={projection ? projectedValues.map((v) => ({ value: v - base })) : undefined}
              startIndex2={todayIndex}
              color2={color}
              thickness2={2}
              strokeDashArray2={[6, 4]}
              hideDataPoints2
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
              startFillColor2={theme.colors.surface}
              startOpacity2={0}
              endOpacity2={0}
              // 次の給料日の予測額の高さの横線。目盛り線と区別するため一点鎖線（長 8・間 3・短 2・間 3）
              data3={projectedEnd ? dates.map(() => ({ value: projectedEnd.balance - base })) : undefined}
              color3={theme.colors.outlineVariant}
              thickness3={1.5}
              strokeDashArray3={[8, 3, 2, 3]}
              hideDataPoints3
              // 金額は左の目盛りの位置に出す
              showReferenceLine1={!!projectedEnd}
              referenceLine1Position={projectedEnd ? projectedEnd.balance - base : 0}
              referenceLine1Config={{
                // 線そのものは data3 で描く（一点鎖線にするため）。ここは左の目盛り位置の金額表示だけに使う
                color: 'transparent',
                thickness: 1,
                width: plotWidth,
                labelText: projectedEnd ? projectedEnd.balance.toLocaleString('ja-JP') : '',
                // 線の左端が目盛りの右端なので、目盛りの幅だけ左に出す。背景で通常の目盛りの数字を隠す
                labelTextStyle: {
                  left: -Y_AXIS_WIDTH,
                  top: -7,
                  width: Y_AXIS_WIDTH - 2,
                  textAlign: 'right',
                  fontSize: 10,
                  fontWeight: 'bold',
                  color: theme.colors.onSurface,
                  backgroundColor: theme.colors.surfaceVariant,
                },
              }}
            />
          ) : (
            <Text variant="bodySmall">今日が給料日です</Text>
          )}
        </View>

        {projection && (
          <View style={styles.legend}>
            <View style={styles.legendItem}>
              <LineSwatch color={color} />
              <Text variant="bodySmall">実績</Text>
            </View>
            <View style={styles.legendItem}>
              <LineSwatch color={color} dashed />
              <Text variant="bodySmall">今までのペースが続いた場合</Text>
            </View>
          </View>
        )}
      </Card.Content>
    </Card>
  );
}

const styles = StyleSheet.create({
  gap: { gap: 8 },
  summary: { flexDirection: 'row', justifyContent: 'space-between' },
  bold: { fontWeight: 'bold' },
  inline: { flexDirection: 'row', alignItems: 'baseline' },
  xLabel: { width: 40, marginLeft: -12 },
  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: 16 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  swatch: { width: 20, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  solid: { width: 20, height: 2 },
  dash: { width: 5, height: 2 },
});
