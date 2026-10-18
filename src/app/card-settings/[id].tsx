import { zodResolver } from '@hookform/resolvers/zod';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { StyleSheet, View } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import { Button, HelperText, List, SegmentedButtons, Snackbar, Text, TextInput, useTheme } from 'react-native-paper';
import { z } from 'zod';

import { QueryState } from '@/components/QueryState';
import { ASSET_KINDS } from '@/features/accounts/accountKinds';
import { nextCardCycle } from '@/features/accounts/cardSchedule';
import { useAccount, useAccounts, useCardSettings, useSaveCardSettings } from '@/features/accounts/hooks';
import { AccountPicker } from '@/features/transactions/components/AccountPicker';
import { formatDay, toTokyoDateString } from '@/lib/date';

const day = z
  .string()
  .refine((v) => /^\d{1,2}$/.test(v.trim()) && Number(v) >= 1 && Number(v) <= 31, '1〜31の数字で入力してください');

const schema = z.object({
  closingDay: day,
  paymentDay: day,
  paymentMonthOffset: z.enum(['1', '2']),
  paymentAccountId: z.string({ message: '引き落とし口座を選んでください' }).min(1, '引き落とし口座を選んでください'),
});

type FormValues = z.infer<typeof schema>;

const isDay = (v: string) => /^\d{1,2}$/.test(v.trim()) && Number(v) >= 1 && Number(v) <= 31;

export default function CardSettingsScreen() {
  const theme = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const account = useAccount(id);
  const accounts = useAccounts();
  const settings = useCardSettings(id);
  const save = useSaveCardSettings();

  const {
    control,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { closingDay: '31', paymentDay: '27', paymentMonthOffset: '1', paymentAccountId: '' },
  });
  const [closingDay, paymentDay, paymentMonthOffset] = useWatch({
    control,
    name: ['closingDay', 'paymentDay', 'paymentMonthOffset'],
  });

  useEffect(() => {
    if (settings.data) {
      reset({
        closingDay: String(settings.data.closing_day),
        paymentDay: String(settings.data.payment_day),
        paymentMonthOffset: String(settings.data.payment_month_offset) as '1' | '2',
        paymentAccountId: settings.data.payment_account_id,
      });
    }
  }, [settings.data, reset]);

  const onSubmit = async (values: FormValues) => {
    try {
      await save.mutateAsync({
        account_id: id,
        closing_day: Number(values.closingDay),
        payment_day: Number(values.paymentDay),
        payment_month_offset: Number(values.paymentMonthOffset),
        payment_account_id: values.paymentAccountId,
      });
      router.back();
    } catch {
      // Snackbar で知らせる
    }
  };

  const title = account.data ? `${account.data.name}の設定` : 'カードの設定';
  if (!account.data || !accounts.data || settings.data === undefined) {
    const error = account.error ?? accounts.error ?? settings.error;
    return (
      <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <Stack.Screen options={{ title }} />
        <QueryState
          isLoading={!error}
          error={error}
          onRetry={() => {
            account.refetch();
            accounts.refetch();
            settings.refetch();
          }}
        />
      </View>
    );
  }

  const next =
    isDay(closingDay) && isDay(paymentDay)
      ? nextCardCycle(
          {
            closing_day: Number(closingDay),
            payment_day: Number(paymentDay),
            payment_month_offset: Number(paymentMonthOffset),
          },
          toTokyoDateString(),
        )
      : null;

  const dayInput = (name: 'closingDay' | 'paymentDay', label: string) => (
    <Controller
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
          style={styles.dayInput}
          right={<TextInput.Affix text="日" />}
        />
      )}
    />
  );

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <Stack.Screen options={{ title }} />
      <KeyboardAwareScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        bottomOffset={24}
      >
        {dayInput('closingDay', '締め日')}
        <HelperText type="error" visible={!!errors.closingDay}>
          {errors.closingDay?.message}
        </HelperText>

        <List.Subheader style={styles.subheader}>引き落とし月</List.Subheader>
        <Controller
          control={control}
          name="paymentMonthOffset"
          render={({ field: { onChange, value } }) => (
            <SegmentedButtons
              value={value}
              onValueChange={onChange}
              buttons={[
                { value: '1', label: '翌月' },
                { value: '2', label: '翌々月' },
              ]}
            />
          )}
        />

        <View style={styles.gap} />
        {dayInput('paymentDay', '引き落とし日')}
        <HelperText type="error" visible={!!errors.paymentDay}>
          {errors.paymentDay?.message}
        </HelperText>

        <Controller
          control={control}
          name="paymentAccountId"
          render={({ field: { onChange, value } }) => (
            <AccountPicker
              label="引き落とし口座"
              kinds={ASSET_KINDS}
              accounts={accounts.data!}
              value={value || null}
              onChange={(v) => onChange(v ?? '')}
              error={errors.paymentAccountId?.message}
            />
          )}
        />

        {next && (
          <View style={styles.preview}>
            <View style={styles.row}>
              <Text variant="bodyLarge">次の引き落とし</Text>
              <Text variant="titleMedium">{formatDay(next.paymentDate)}</Text>
            </View>
            <View style={styles.row}>
              <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant }}>
                締め日
              </Text>
              <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant }}>
                {formatDay(next.closingDate)}
              </Text>
            </View>
          </View>
        )}

        <Button
          mode="contained"
          style={styles.button}
          onPress={() => handleSubmit(onSubmit)()}
          loading={isSubmitting}
          disabled={isSubmitting}
        >
          保存
        </Button>
      </KeyboardAwareScrollView>

      <Snackbar visible={save.isError} onDismiss={save.reset}>
        保存できませんでした。通信状態を確認してください
      </Snackbar>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 16, paddingBottom: 48 },
  dayInput: { width: 160 },
  subheader: { paddingHorizontal: 0 },
  gap: { height: 16 },
  preview: { marginTop: 16, gap: 4 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  button: { marginTop: 24 },
});
