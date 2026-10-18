import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { Button, Chip, Text } from 'react-native-paper';

import { addDays, dateStringToLocalDate, formatDay, localDateToDateString, toTokyoDateString } from '@/lib/date';

type Props = {
  value: string;
  onChange: (date: string) => void;
};

export function DateField({ value, onChange }: Props) {
  const [showInline, setShowInline] = useState(false);
  const today = toTokyoDateString();
  const yesterday = addDays(today, -1);

  const open = () => {
    if (Platform.OS === 'android') {
      DateTimePickerAndroid.open({
        value: dateStringToLocalDate(value),
        mode: 'date',
        onValueChange: (_event, date) => onChange(localDateToDateString(date)),
      });
    } else {
      setShowInline((v) => !v);
    }
  };

  return (
    <View style={styles.container}>
      <Text variant="labelLarge">日付</Text>
      <View style={styles.row}>
        <Button mode="outlined" icon="calendar" onPress={open}>
          {formatDay(value)}
        </Button>
        <Chip selected={value === today} showSelectedOverlay onPress={() => onChange(today)}>
          今日
        </Chip>
        <Chip selected={value === yesterday} showSelectedOverlay onPress={() => onChange(yesterday)}>
          昨日
        </Chip>
      </View>
      {showInline && Platform.OS !== 'android' && (
        <DateTimePicker
          value={dateStringToLocalDate(value)}
          mode="date"
          display="inline"
          onValueChange={(_event, date) => onChange(localDateToDateString(date))}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 4 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
});
