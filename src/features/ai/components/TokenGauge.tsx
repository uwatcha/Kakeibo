import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Button, Dialog, Portal, Text, useTheme } from 'react-native-paper';
import Svg, { Circle } from 'react-native-svg';

import { warningColors } from '@/theme';

const SIZE = 22;
const STROKE = 4;
/** これを超えたら色を変えて、新しい会話にする目安を知らせる */
const WARN_RATIO = 0.8;

type Props = {
  modelLabel: string;
  /** この会話で使ったトークン（直近の返事の合計）。まだ送っていなければ 0 */
  used: number;
  /** モデルが一度に読めるトークン */
  limit: number;
  todayCount: number;
  todayTokens: number;
};

const n = (value: number) => value.toLocaleString('ja-JP');

/** 右上の小さな円のゲージ（この会話で使ったトークンの割合）。押すと詳しい数字を出す */
export function TokenGauge({ modelLabel, used, limit, todayCount, todayTokens }: Props) {
  const theme = useTheme();
  const [open, setOpen] = useState(false);
  const ratio = limit > 0 ? Math.min(1, used / limit) : 0;
  const radius = (SIZE - STROKE) / 2;
  const circumference = 2 * Math.PI * radius;
  const color = ratio > WARN_RATIO ? warningColors(theme.dark).color : theme.colors.primary;

  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        hitSlop={10}
        accessibilityRole="button"
        accessibilityLabel={`トークンの使用量 ${Math.round(ratio * 100)}%`}
        style={styles.gauge}
      >
        <Svg width={SIZE} height={SIZE}>
          <Circle
            cx={SIZE / 2}
            cy={SIZE / 2}
            r={radius}
            stroke={theme.colors.outlineVariant}
            strokeWidth={STROKE}
            fill="none"
          />
          {/* 12時の位置から時計回りに、使った割合だけ描く */}
          <Circle
            cx={SIZE / 2}
            cy={SIZE / 2}
            r={radius}
            stroke={color}
            strokeWidth={STROKE}
            fill="none"
            strokeLinecap="round"
            strokeDasharray={`${circumference * ratio} ${circumference}`}
            transform={`rotate(-90 ${SIZE / 2} ${SIZE / 2})`}
          />
        </Svg>
      </Pressable>

      <Portal>
        <Dialog visible={open} onDismiss={() => setOpen(false)}>
          <Dialog.Title>トークン</Dialog.Title>
          <Dialog.Content style={styles.content}>
            <Row label="モデル" value={modelLabel} />
            <Row label="この会話で使用" value={`${n(used)}（${Math.round(ratio * 100)}%）`} />
            <Row label="この会話の残り" value={n(Math.max(0, limit - used))} />
            <Row label="一度に読める量" value={n(limit)} />
            <Row label="今日の相談" value={`${n(todayCount)}回・${n(todayTokens)} トークン`} />
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setOpen(false)}>閉じる</Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  const theme = useTheme();
  return (
    <View style={styles.row}>
      <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant }}>
        {label}
      </Text>
      <Text variant="bodyMedium" style={styles.value}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  gauge: { paddingHorizontal: 10, justifyContent: 'center' },
  content: { gap: 6 },
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  value: { fontWeight: '700', fontVariant: ['tabular-nums'], flexShrink: 1, textAlign: 'right' },
});
