import { type ReactNode, useEffect, useState } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import { HelperText, Text, useTheme } from 'react-native-paper';

import { ChipGroup } from '@/components/ChipGroup';
import type { Category } from '@/features/categories/api';
import { RADIUS } from '@/theme';

import type { CategoryKind } from '../transactionRules';

type Props = {
  kind: CategoryKind;
  categories: readonly Category[];
  value: string | null;
  onChange: (id: string | null) => void;
  error?: string;
  label?: string;
  /** 2 ならチップを2行に並べる（記録の入力画面） */
  rows?: 1 | 2;
};

/** 小分類の列が出てきたとき、上から滑り込ませて背景を2回光らせ、出てきたことに気づけるようにする */
function AppearHighlight({ children }: { children: ReactNode }) {
  const theme = useTheme();
  const [enter] = useState(() => new Animated.Value(0));
  const [glow] = useState(() => new Animated.Value(0));
  useEffect(() => {
    const pulse = (toValue: number, duration: number) =>
      Animated.timing(glow, { toValue, duration, useNativeDriver: true });
    Animated.parallel([
      Animated.timing(enter, { toValue: 1, duration: 200, useNativeDriver: true }),
      Animated.sequence([pulse(1, 180), pulse(0.25, 220), pulse(1, 180), pulse(0, 600)]),
    ]).start();
  }, [enter, glow]);
  return (
    <Animated.View
      style={[
        styles.highlight,
        {
          opacity: enter,
          transform: [{ translateY: enter.interpolate({ inputRange: [0, 1], outputRange: [-6, 0] }) }],
        },
      ]}
    >
      <Animated.View
        pointerEvents="none"
        style={[
          StyleSheet.absoluteFill,
          styles.glow,
          { backgroundColor: theme.colors.primaryContainer, opacity: glow },
        ]}
      />
      {children}
    </Animated.View>
  );
}

/** 大分類を選ぶと、小分類があればその下に出す。大分類だけでも記録できる */
export function CategoryPicker({ kind, categories, value, onChange, error, label = 'カテゴリ', rows = 1 }: Props) {
  const usable = categories.filter((c) => c.kind === kind && (!c.is_archived || c.id === value));
  const parents = usable.filter((c) => c.parent_id === null);
  const selected = usable.find((c) => c.id === value);
  const selectedParentId = selected?.parent_id ?? selected?.id ?? null;
  const children = usable.filter((c) => c.parent_id !== null && c.parent_id === selectedParentId);

  return (
    <View style={styles.container}>
      <Text variant="labelLarge">{label}</Text>
      <ChipGroup
        options={parents.map((c) => ({ value: c.id, label: c.name }))}
        value={selectedParentId}
        onChange={onChange}
        allowDeselect
        rows={rows}
      />
      {children.length > 0 && (
        // 大分類が変わるたびに作り直して、もう一度光らせる
        <AppearHighlight key={selectedParentId}>
          <ChipGroup
            options={children.map((c) => ({ value: c.id, label: c.name }))}
            value={selected?.parent_id ? selected.id : null}
            onChange={(id) => onChange(id ?? selectedParentId)}
            allowDeselect
            rows={rows}
          />
        </AppearHighlight>
      )}
      {!!error && <HelperText type="error">{error}</HelperText>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 4 },
  highlight: { marginHorizontal: -6, paddingHorizontal: 6 },
  glow: { borderRadius: RADIUS.tile },
});
