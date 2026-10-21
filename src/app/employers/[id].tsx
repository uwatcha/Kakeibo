import { zodResolver } from '@hookform/resolvers/zod';
import { useQueryClient } from '@tanstack/react-query';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { StyleSheet, View } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import { Button, HelperText, List, SegmentedButtons, Snackbar, Text, TextInput, useTheme } from 'react-native-paper';
import { z } from 'zod';

import { QueryState } from '@/components/QueryState';
import { ASSET_KINDS } from '@/features/accounts/accountKinds';
import { useAccounts } from '@/features/accounts/hooks';
import { useCreateEmployer, useEmployers, useUpdateEmployer } from '@/features/employers/hooks';
import { SHIFT_LABELS } from '@/features/employers/labels';
import { actualPayday, type PaydayShift } from '@/features/employers/payday';
import { replanSalary } from '@/features/employers/salaryPlans';
import { AccountPicker } from '@/features/transactions/components/AccountPicker';
import { formatDay, toTokyoDateString } from '@/lib/date';
import { parseNonNegativeYen } from '@/lib/money';

const schema = z.object({
  name: z.string().trim().min(1, '名前を入力してください').max(30, '30文字以内にしてください'),
  payday: z
    .string()
    .refine((v) => /^\d{1,2}$/.test(v.trim()) && Number(v) >= 1 && Number(v) <= 31, '1〜31の数字で入力してください'),
  paydayShift: z.enum(['before', 'after']),
  salaryAmount: z
    .string()
    .refine((v) => v.trim() === '' || (parseNonNegativeYen(v) ?? 0) > 0, '1円以上の整数（円）で入力してください'),
  salaryAccountId: z.string().nullable(),
});

type FormValues = z.infer<typeof schema>;

/** 今月から3か月分の実際の給料日 */
function upcomingPaydays(payday: number, shift: PaydayShift, today: string) {
  const [year, month] = today.split('-').map(Number);
  return [0, 1, 2].map((delta) => {
    const index = year * 12 + (month - 1) + delta;
    const y = Math.floor(index / 12);
    const m = (index % 12) + 1;
    return actualPayday(y, m, { payday, payday_shift: shift });
  });
}

export default function EmployerEditScreen() {
  const theme = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const isNew = id === 'new';

  const employers = useEmployers();
  const create = useCreateEmployer();
  const update = useUpdateEmployer();
  const accounts = useAccounts();
  const queryClient = useQueryClient();
  const employer = employers.data?.find((e) => e.id === id);

  const {
    control,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { name: '', payday: '25', paydayShift: 'before', salaryAmount: '', salaryAccountId: null },
  });
  const payday = useWatch({ control, name: 'payday' });
  const paydayShift = useWatch({ control, name: 'paydayShift' });

  useEffect(() => {
    if (employer) {
      reset({
        name: employer.name,
        payday: String(employer.payday),
        paydayShift: employer.payday_shift,
        salaryAmount: employer.salary_amount ? String(employer.salary_amount) : '',
        salaryAccountId: employer.salary_account_id,
      });
    }
  }, [employer, reset]);

  const onSubmit = async (values: FormValues) => {
    const row = {
      name: values.name,
      payday: Number(values.payday),
      payday_shift: values.paydayShift,
      salary_amount: values.salaryAmount.trim() === '' ? null : parseNonNegativeYen(values.salaryAmount),
      salary_account_id: values.salaryAccountId,
    };
    try {
      let employerId = id;
      if (isNew) {
        const maxOrder = Math.max(0, ...(employers.data ?? []).map((e) => e.sort_order));
        employerId = await create.mutateAsync({ ...row, sort_order: maxOrder + 10 });
      } else {
        await update.mutateAsync({ id, values: row });
      }
      // 目安・入金先・給料日が変わったかもしれないので、今日より後の給料の予定を入れ直す
      await replanSalary(employerId, toTokyoDateString());
      await queryClient.invalidateQueries();
      router.back();
    } catch {
      // Snackbar で知らせる
    }
  };

  const setArchived = async (isArchived: boolean) => {
    try {
      await update.mutateAsync({ id, values: { is_archived: isArchived } });
      router.back();
    } catch {
      // 同上
    }
  };

  const title = isNew ? '働き先を追加' : '働き先を編集';
  if (!employers.data || (!isNew && !employer)) {
    return (
      <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <Stack.Screen options={{ title }} />
        <QueryState isLoading={employers.isLoading} error={employers.error} onRetry={employers.refetch} />
      </View>
    );
  }

  const paydayNumber = Number(payday);
  const validPayday = /^\d{1,2}$/.test(payday.trim()) && paydayNumber >= 1 && paydayNumber <= 31;
  const preview = validPayday ? upcomingPaydays(paydayNumber, paydayShift, toTokyoDateString()) : [];
  const saving = isSubmitting || update.isPending;

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <Stack.Screen options={{ title }} />
      <KeyboardAwareScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        bottomOffset={24}
      >
        <Controller
          control={control}
          name="name"
          render={({ field: { onChange, onBlur, value } }) => (
            <TextInput
              mode="outlined"
              label="働き先の名前"
              autoFocus={isNew}
              value={value}
              onChangeText={onChange}
              onBlur={onBlur}
              error={!!errors.name}
            />
          )}
        />
        <HelperText type="error" visible={!!errors.name}>
          {errors.name?.message}
        </HelperText>

        <View style={styles.paydayRow}>
          <Controller
            control={control}
            name="payday"
            render={({ field: { onChange, onBlur, value } }) => (
              <TextInput
                mode="outlined"
                label="給料日"
                keyboardType="number-pad"
                value={value}
                onChangeText={onChange}
                onBlur={onBlur}
                error={!!errors.payday}
                style={styles.paydayInput}
                right={<TextInput.Affix text="日" />}
              />
            )}
          />
        </View>
        <HelperText type="error" visible={!!errors.payday}>
          {errors.payday?.message}
        </HelperText>

        <List.Subheader style={styles.subheader}>給料日が土日祝・年末年始のとき</List.Subheader>
        <Controller
          control={control}
          name="paydayShift"
          render={({ field: { onChange, value } }) => (
            <SegmentedButtons
              value={value}
              onValueChange={onChange}
              buttons={[
                { value: 'before', label: SHIFT_LABELS.before },
                { value: 'after', label: SHIFT_LABELS.after },
              ]}
            />
          )}
        />

        {/* 給料の目安と入金先があれば、2か月先までの給料日に収入の予定を自動で入れる */}
        <Controller
          control={control}
          name="salaryAmount"
          render={({ field: { onChange, onBlur, value } }) => (
            <TextInput
              mode="outlined"
              label="給料の目安（任意）"
              keyboardType="number-pad"
              value={value}
              onChangeText={onChange}
              onBlur={onBlur}
              error={!!errors.salaryAmount}
              style={styles.salary}
              right={<TextInput.Affix text="円" />}
            />
          )}
        />
        <HelperText type="error" visible={!!errors.salaryAmount}>
          {errors.salaryAmount?.message}
        </HelperText>
        {accounts.data && (
          <Controller
            control={control}
            name="salaryAccountId"
            render={({ field: { onChange, value } }) => (
              <AccountPicker
                label="入金先"
                kinds={ASSET_KINDS}
                accounts={accounts.data!}
                value={value}
                onChange={onChange}
              />
            )}
          />
        )}

        {preview.length > 0 && (
          <View style={styles.preview}>
            <Text variant="labelLarge">これからの給料日</Text>
            {preview.map((date) => (
              <Text key={date} variant="bodyMedium">
                {formatDay(date)}
              </Text>
            ))}
          </View>
        )}

        <Button
          mode="contained"
          style={styles.button}
          onPress={() => handleSubmit(onSubmit)()}
          loading={saving}
          disabled={saving}
        >
          保存
        </Button>

        {employer && (
          <Button
            mode="outlined"
            style={styles.button}
            icon={employer.is_archived ? 'eye' : 'eye-off'}
            onPress={() => setArchived(!employer.is_archived)}
            disabled={saving}
          >
            {employer.is_archived ? '表示に戻す' : '非表示にする'}
          </Button>
        )}
      </KeyboardAwareScrollView>

      <Snackbar visible={create.isError || update.isError} onDismiss={() => (create.reset(), update.reset())}>
        保存できませんでした。通信状態を確認してください
      </Snackbar>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 16, paddingBottom: 48 },
  paydayRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  paydayInput: { width: 140 },
  subheader: { paddingHorizontal: 0 },
  preview: { marginTop: 16, gap: 4 },
  salary: { marginTop: 16 },
  button: { marginTop: 16 },
});
