import type { ReactNode } from 'react';
import { type StyleProp, StyleSheet, View, type ViewStyle } from 'react-native';
import { Text, useTheme } from 'react-native-paper';

import { RADIUS, SPACING } from '@/theme';

type Props = {
  title?: string;
  /** 見出しの右（合計金額など）。行の右端とそろう */
  right?: ReactNode;
  /** 見出しの左（アイコンなど） */
  left?: ReactNode;
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
};

/** 白い角丸のカード。見出しの右と中の行の右端は同じ余白なので、金額の「円」が縦にそろう */
export function SectionCard({ title, right, left, children, style }: Props) {
  const theme = useTheme();
  return (
    <View style={[styles.card, { backgroundColor: theme.colors.surface }, theme.dark ? null : styles.shadow, style]}>
      {title !== undefined && (
        <View style={styles.header}>
          {left}
          <Text variant="titleMedium" style={styles.title} numberOfLines={1}>
            {title}
          </Text>
          {right}
        </View>
      )}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: RADIUS.card, paddingVertical: 6 },
  shadow: {
    elevation: 1,
    shadowColor: '#1a2b40',
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: SPACING.row,
    paddingTop: 10,
    paddingBottom: 4,
  },
  title: { flex: 1, fontWeight: '700' },
});
