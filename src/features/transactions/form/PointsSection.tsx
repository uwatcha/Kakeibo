import { useState } from 'react';
import { type Control, Controller, type FieldErrors } from 'react-hook-form';
import { StyleSheet, View } from 'react-native';
import { HelperText, List, TextInput } from 'react-native-paper';

import type { FormValues } from './values';

const FIELDS = [
  ['listPrice', '本来の金額'],
  ['pointsUsed', '利用ポイント'],
] as const;

/** 本来の金額・利用ポイント（REQ-18）。保存済みの値があれば最初から開いておく。押したら押した方を優先 */
export function PointsSection({
  control,
  errors,
  initiallyOpen,
}: {
  control: Control<FormValues>;
  errors: FieldErrors<FormValues>;
  initiallyOpen: boolean;
}) {
  const [open, setOpen] = useState<boolean | null>(null);
  const expanded = open ?? initiallyOpen;
  const error = errors.listPrice ?? errors.pointsUsed;
  return (
    <List.Accordion
      title="ポイント"
      left={(props) => <List.Icon {...props} icon="ticket-percent" />}
      expanded={expanded}
      onPress={() => setOpen(!expanded)}
      style={styles.accordion}
    >
      <View style={styles.row}>
        {FIELDS.map(([name, label]) => (
          <Controller
            key={name}
            control={control}
            name={name}
            render={({ field: { onChange, onBlur, value } }) => (
              <TextInput
                mode="outlined"
                label={label}
                keyboardType="number-pad"
                value={value}
                onChangeText={onChange}
                onBlur={onBlur}
                error={!!errors[name]}
                style={styles.input}
              />
            )}
          />
        ))}
      </View>
      {!!error && <HelperText type="error">{error.message}</HelperText>}
    </List.Accordion>
  );
}

const styles = StyleSheet.create({
  accordion: { paddingHorizontal: 0 },
  row: { flexDirection: 'row', gap: 8 },
  input: { flex: 1 },
});
