import { StyleSheet, View } from 'react-native';
import { Chip, Text, useTheme } from 'react-native-paper';

import { addDays, toTokyoDateString } from '@/lib/date';

type Props = {
  value: string;
  onChange: (date: string) => void;
};

/**
 * 日付の欄の Web 版（PC）。スマホのカレンダーの部品（@react-native-community/datetimepicker）は Web では動かないので、
 * ブラウザの日付の入力欄を使う。今日・昨日のボタンはスマホと同じ（DateField.tsx）
 */
export function DateField({ value, onChange }: Props) {
  const theme = useTheme();
  const today = toTokyoDateString();
  const yesterday = addDays(today, -1);
  return (
    <View style={styles.container}>
      <Text variant="labelLarge">日付</Text>
      <View style={styles.row}>
        <input
          type="date"
          value={value}
          onChange={(e) => e.target.value && onChange(e.target.value)}
          style={{
            font: 'inherit',
            fontSize: 15,
            padding: '6px 10px',
            borderRadius: 20,
            border: `1px solid ${theme.colors.outline}`,
            background: 'transparent',
            color: theme.colors.onSurface,
            colorScheme: theme.dark ? 'dark' : 'light',
          }}
        />
        <Chip selected={value === today} showSelectedOverlay onPress={() => onChange(today)}>
          今日
        </Chip>
        <Chip selected={value === yesterday} showSelectedOverlay onPress={() => onChange(yesterday)}>
          昨日
        </Chip>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 4 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
});
