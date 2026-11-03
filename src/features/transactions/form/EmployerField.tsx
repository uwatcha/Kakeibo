import { type Control, Controller, type FieldErrors } from 'react-hook-form';
import { StyleSheet, View } from 'react-native';
import { HelperText, Text } from 'react-native-paper';

import { ChipGroup } from '@/components/ChipGroup';
import type { Employer } from '@/features/employers/api';

import type { FormValues } from './values';

type Props = {
  control: Control<FormValues>;
  errors: FieldErrors<FormValues>;
  employers: readonly Employer[];
  /** 選んだとき（内容が空なら働き先の名前を入れる） */
  onPick: (employerId: string) => void;
};

/** 給与・アルバイトの収入の収入元（働き先）。必ず選ぶ */
export function EmployerField({ control, errors, employers, onPick }: Props) {
  return (
    <Controller
      control={control}
      name="employerId"
      render={({ field: { onChange, value } }) => {
        const usable = employers.filter((e) => !e.is_archived || e.id === value);
        return (
          <View style={styles.field}>
            <Text variant="labelLarge">収入元</Text>
            {usable.length > 0 ? (
              <ChipGroup
                options={usable.map((e) => ({ value: e.id, label: e.name, icon: 'briefcase' }))}
                value={value}
                onChange={(next) => {
                  onChange(next);
                  if (next) onPick(next);
                }}
              />
            ) : (
              <HelperText type="error">設定の「収入元と入金日」で収入元を登録してください</HelperText>
            )}
            {!!errors.employerId && <HelperText type="error">{errors.employerId.message}</HelperText>}
          </View>
        );
      }}
    />
  );
}

const styles = StyleSheet.create({ field: { gap: 4 } });
