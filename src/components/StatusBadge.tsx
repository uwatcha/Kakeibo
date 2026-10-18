import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import type { ComponentProps } from 'react';
import { StyleSheet, View } from 'react-native';
import { Text, useTheme } from 'react-native-paper';

import { warningColors } from '@/theme';

type IconName = ComponentProps<typeof MaterialCommunityIcons>['name'];

const BADGES = {
  planned: { label: '予定', icon: 'calendar-clock' },
  unconfirmed: { label: '未確認', icon: 'alert-circle-outline' },
} as const satisfies Record<string, { label: string; icon: IconName }>;

/** 記録の状態の小さな印。予定は落ち着いた色、未確認は橙で目立たせる */
export function StatusBadge({ status }: { status: keyof typeof BADGES }) {
  const theme = useTheme();
  const colors =
    status === 'unconfirmed'
      ? warningColors(theme.dark)
      : { background: theme.colors.secondaryContainer, color: theme.colors.onSecondaryContainer };
  const badge = BADGES[status];
  return (
    <View style={[styles.badge, { backgroundColor: colors.background }]}>
      <MaterialCommunityIcons name={badge.icon} size={14} color={colors.color} />
      <Text variant="labelSmall" style={[styles.label, { color: colors.color }]}>
        {badge.label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
  },
  label: { fontWeight: '700' },
});
