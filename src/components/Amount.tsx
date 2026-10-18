import { type StyleProp, StyleSheet, type TextStyle } from 'react-native';
import { Text, useTheme } from 'react-native-paper';

import { formatSignedYen, formatYen, MINUS } from '@/lib/money';
import { positiveColor } from '@/theme';

/**
 * 金額の見せ方（プラスかマイナスかを色と符号の両方で示す。色だけに頼らない）
 * - balance: 残高。マイナスだけ赤で「−」
 * - income / expense / neutral: お金の出入り。収入は緑で「+」、支出は「−」、振替・貸し借りなどは灰色で符号なし
 * - delta: 増減。必ず符号を付け、増えたら緑、減ったら赤
 */
export type AmountKind = 'balance' | 'income' | 'expense' | 'neutral' | 'delta';

type Props = {
  value: number;
  kind?: AmountKind;
  variant?: React.ComponentProps<typeof Text>['variant'];
  style?: StyleProp<TextStyle>;
  numberOfLines?: number;
  adjustsFontSizeToFit?: boolean;
};

export function useAmountColors() {
  const theme = useTheme();
  return {
    positive: positiveColor(theme.dark),
    negative: theme.colors.error,
    muted: theme.colors.onSurfaceVariant,
  };
}

export function Amount({ value, kind = 'balance', variant, style, numberOfLines, adjustsFontSizeToFit }: Props) {
  const colors = useAmountColors();
  let text: string;
  let color: string | undefined;
  switch (kind) {
    case 'balance':
      text = formatYen(value);
      color = value < 0 ? colors.negative : undefined;
      break;
    case 'income':
      text = `+${formatYen(value)}`;
      color = colors.positive;
      break;
    case 'expense':
      text = `${MINUS}${formatYen(value)}`;
      break;
    case 'neutral':
      text = formatYen(value);
      color = colors.muted;
      break;
    case 'delta':
      text = formatSignedYen(value);
      color = value > 0 ? colors.positive : value < 0 ? colors.negative : undefined;
      break;
  }
  return (
    <Text
      variant={variant}
      style={[styles.number, color ? { color } : null, style]}
      numberOfLines={numberOfLines}
      adjustsFontSizeToFit={adjustsFontSizeToFit}
    >
      {text}
    </Text>
  );
}

const styles = StyleSheet.create({
  number: { fontVariant: ['tabular-nums'] },
});
