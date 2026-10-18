import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import type { ComponentProps, ReactNode } from 'react';
import { type StyleProp, StyleSheet, View, type ViewStyle } from 'react-native';
import { Text, TouchableRipple, useTheme } from 'react-native-paper';

import { RADIUS, SPACING } from '@/theme';

type IconName = ComponentProps<typeof MaterialCommunityIcons>['name'];

type Props = {
  title: string;
  subtitle?: ReactNode;
  icon?: string;
  /** アイコンを色付きの丸の中に置く（記録の一覧など、行を見分けやすくしたいとき） */
  iconBackground?: string;
  iconColor?: string;
  /** 右端（金額・スイッチ・矢印など）。カードの見出しの右と同じ位置にそろう */
  right?: ReactNode;
  onPress?: () => void;
  onLongPress?: () => void;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
};

/** カードの中の1行。左にアイコン、中に名前と補足、右に金額など */
export function ListRow({
  title,
  subtitle,
  icon,
  iconBackground,
  iconColor,
  right,
  onPress,
  onLongPress,
  disabled,
  style,
}: Props) {
  const theme = useTheme();
  const color = iconColor ?? theme.colors.primary;
  return (
    <TouchableRipple onPress={onPress} onLongPress={onLongPress} disabled={disabled} style={style}>
      <View style={[styles.row, disabled && styles.disabled]}>
        {icon &&
          (iconBackground ? (
            <View style={[styles.iconCircle, { backgroundColor: iconBackground }]}>
              <MaterialCommunityIcons name={icon as IconName} size={22} color={color} />
            </View>
          ) : (
            <MaterialCommunityIcons name={icon as IconName} size={24} color={color} style={styles.icon} />
          ))}
        <View style={styles.body}>
          <Text variant="bodyLarge" numberOfLines={1}>
            {title}
          </Text>
          {typeof subtitle === 'string' ? (
            <Text variant="bodySmall" numberOfLines={1} style={{ color: theme.colors.onSurfaceVariant }}>
              {subtitle}
            </Text>
          ) : (
            subtitle
          )}
        </View>
        {right}
      </View>
    </TouchableRipple>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    minHeight: 48,
    paddingHorizontal: SPACING.row,
    paddingVertical: 8,
  },
  disabled: { opacity: 0.5 },
  icon: { width: 24 },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: RADIUS.icon,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: { flex: 1, gap: 2 },
});
