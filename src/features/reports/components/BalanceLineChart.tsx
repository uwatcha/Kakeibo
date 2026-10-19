import { StyleSheet, View } from 'react-native';
import { LineChart } from 'react-native-gifted-charts';
import { Text, useTheme } from 'react-native-paper';

import type { BalancePoint } from '@/features/reports/balanceSeries';
import { SLICE_COLORS } from '@/features/reports/palette';

export const Y_AXIS_WIDTH = 44;

/** 軸の目盛り用（25万、3.5万、8,000） */
export function compactYen(value: number): string {
  if (Math.abs(value) >= 10000) {
    const man = value / 10000;
    return `${Number.isInteger(man) ? man : man.toFixed(1)}万`;
  }
  return value.toLocaleString('ja-JP');
}

export const shortDate = (date: string) => `${Number(date.slice(5, 7))}/${Number(date.slice(8, 10))}`;

/** 凡例の線の見本 */
export function LineSwatch({ color, dashed }: { color: string; dashed?: boolean }) {
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

export function useLineColor(): string {
  const theme = useTheme();
  return theme.dark ? SLICE_COLORS.dark[0] : SLICE_COLORS.light[0];
}

type Props = {
  points: readonly BalancePoint[];
  today: string;
  /** グラフ全体の幅（左の目盛りを含む） */
  width: number;
  height: number;
  /** 横軸の目盛りの文字（出さない日は空文字） */
  labelFor: (index: number) => string;
  /**
   * 【以前止めた機能。不要なら消す（CLAUDE.md「止めている機能」）】今までのペースが続いた場合の予測の線。
   * 今は渡していない
   */
  projection?: readonly BalancePoint[] | null;
  /** 1日あたりの横幅。渡すと全体が幅に収まらなくても縮めず、横にスクロールできるようにして今日の付近から見せる */
  daySpacing?: number;
};

/**
 * 日ごとの残高の折れ線。今日までは実線（下を塗る）、今日より後の予定は点線。今日の点に印を付ける
 */
export function BalanceLineChart({ points, today, width, height, labelFor, projection, daySpacing }: Props) {
  const theme = useTheme();
  const color = useLineColor();
  const count = points.length;
  // 今日の位置。期間がすべて未来なら -1、すべて過去なら最後
  const todayIndex = points.findLastIndex((p) => p.date <= today);
  const allPlanned = todayIndex < 0;
  const hasPlanned = todayIndex < count - 1;

  // 縦軸は期間の最小値の少し下から始める（0 からだと線が上に張り付いて動きが見えない）
  const values = [...points.map((p) => p.balance), ...(projection ?? []).map((p) => p.balance)];
  const min = Math.min(...values);
  const max = Math.max(...values);
  const margin = Math.max((max - min) * 0.15, 1000);
  const base = Math.floor((min - margin) / 1000) * 1000;
  const top = Math.ceil((max + margin - base) / 1000) * 1000;

  const plotWidth = Math.max(0, width - Y_AXIS_WIDTH - 24);
  const fitSpacing = count > 1 ? plotWidth / (count - 1) : plotWidth;
  // 収まるなら幅いっぱいに広げ、収まらないときだけスクロールさせる
  const spacing = daySpacing ? Math.max(daySpacing, fitSpacing) : fitSpacing;
  const scrollable = spacing > fitSpacing;
  const muted = { color: theme.colors.onSurfaceVariant, fontSize: 10 };

  if (count < 2) return <Text variant="bodySmall">表示できる日がありません</Text>;

  return (
    <LineChart
      data={points.map((p, i) => ({
        value: p.balance - base,
        label: labelFor(i),
        hideDataPoint: i !== todayIndex,
      }))}
      // 今日より後は data2（点線）で描く
      endIndex1={allPlanned ? undefined : todayIndex}
      strokeDashArray1={allPlanned ? [6, 4] : undefined}
      data2={!allPlanned && hasPlanned ? points.map((p) => ({ value: p.balance - base })) : undefined}
      startIndex2={todayIndex}
      color2={color}
      thickness2={2}
      strokeDashArray2={[6, 4]}
      hideDataPoints2
      startFillColor2={theme.colors.surface}
      startOpacity2={0}
      endOpacity2={0}
      data3={
        projection
          ? points.map((p) => ({ value: (projection.find((q) => q.date === p.date)?.balance ?? p.balance) - base }))
          : undefined
      }
      startIndex3={Math.max(0, todayIndex)}
      color3={theme.colors.outline}
      thickness3={1.5}
      strokeDashArray3={[2, 4]}
      hideDataPoints3
      height={height}
      width={plotWidth}
      spacing={spacing}
      initialSpacing={4}
      endSpacing={4}
      // 横にスクロールするときは、開いたときに今日（なければ最後）の付近を出す
      disableScroll={!scrollable}
      scrollToIndex={scrollable ? Math.max(0, todayIndex) : undefined}
      scrollAnimation={false}
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
      areaChart={!allPlanned}
      startFillColor={color}
      endFillColor={color}
      startOpacity={0.18}
      endOpacity={0.02}
    />
  );
}

const styles = StyleSheet.create({
  xLabel: { width: 40, marginLeft: -12 },
  swatch: { width: 20, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  solid: { width: 20, height: 2 },
  dash: { width: 5, height: 2 },
});
