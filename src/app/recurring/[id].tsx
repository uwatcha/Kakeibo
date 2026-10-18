import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Controller, type Resolver, useForm, useWatch } from 'react-hook-form';
import { StyleSheet, View } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import {
  Button,
  Dialog,
  HelperText,
  List,
  Portal,
  SegmentedButtons,
  Snackbar,
  Switch,
  Text,
  TextInput,
  useTheme,
} from 'react-native-paper';

import { Amount } from '@/components/Amount';
import { QueryState } from '@/components/QueryState';
import { useAccounts } from '@/features/accounts/hooks';
import { useCategories } from '@/features/categories/hooks';
import type { RecurringRule } from '@/features/recurring/api';
import {
  useDeleteGenerated,
  useDeleteRule,
  useGeneratedTransactions,
  useRules,
  useSaveRule,
  useSetRuleActive,
} from '@/features/recurring/hooks';
import { SHIFT_LABELS } from '@/features/recurring/labels';
import { nextOccurrence, type RecurringShift } from '@/features/recurring/schedule';
import { AccountPicker } from '@/features/transactions/components/AccountPicker';
import { CategoryPicker } from '@/features/transactions/components/CategoryPicker';
import { DateField } from '@/features/transactions/components/DateField';
import { type DraftErrors, TRANSACTION_RULES, validateDraft } from '@/features/transactions/transactionRules';
import { formatDay, toTokyoDateString } from '@/lib/date';
import { parseYen } from '@/lib/money';

type RuleType = 'expense' | 'income' | 'transfer';

type FormValues = {
  name: string;
  type: RuleType;
  amount: string;
  fromAccountId: string | null;
  toAccountId: string | null;
  categoryId: string | null;
  intervalMonths: '1' | '2';
  dayOfMonth: string;
  holidayShift: RecurringShift;
  startDate: string;
};

const isDay = (v: string) => /^\d{1,2}$/.test(v.trim()) && Number(v) >= 1 && Number(v) <= 31;

function toForm(rule: RecurringRule): FormValues {
  return {
    name: rule.name,
    type: rule.type as RuleType,
    amount: String(rule.amount),
    fromAccountId: rule.from_account_id,
    toAccountId: rule.to_account_id,
    categoryId: rule.category_id,
    intervalMonths: rule.interval_months === 2 ? '2' : '1',
    dayOfMonth: String(rule.day_of_month),
    holidayShift: rule.holiday_shift,
    startDate: rule.start_date,
  };
}

export default function RecurringRuleScreen() {
  const theme = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const isNew = id === 'new';
  const today = toTokyoDateString();

  const rules = useRules();
  const accounts = useAccounts();
  const categories = useCategories();
  const generated = useGeneratedTransactions(isNew ? undefined : id);
  const save = useSaveRule();
  const setActive = useSetRuleActive();
  const deleteGenerated = useDeleteGenerated();
  const deleteRule = useDeleteRule();
  const [confirm, setConfirm] = useState<'generated' | 'rule' | null>(null);

  const rule = rules.data?.find((r) => r.id === id);

  // 記録の種類ごとのルール（transactionRules.ts）で口座・カテゴリを確かめる
  const resolver: Resolver<FormValues> = (values) => {
    const errors: DraftErrors & { name?: string; dayOfMonth?: string } = validateDraft(
      {
        type: values.type,
        amount: parseYen(values.amount),
        fromAccountId: values.fromAccountId,
        toAccountId: values.toAccountId,
        adjustmentDirection: 'increase',
        categoryId: values.categoryId,
        date: values.startDate,
      },
      accounts.data ?? [],
      categories.data ?? [],
    );
    if (values.name.trim() === '') errors.name = '内容を入力してください';
    if (!isDay(values.dayOfMonth)) errors.dayOfMonth = '1〜31の数字で入力してください';
    const entries = Object.entries(errors);
    if (entries.length === 0) return { values, errors: {} };
    return {
      values: {},
      errors: Object.fromEntries(entries.map(([key, message]) => [key, { type: 'validate', message }])),
    };
  };

  const {
    control,
    handleSubmit,
    reset,
    setValue,
    getValues,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver,
    defaultValues: {
      name: '',
      type: 'expense',
      amount: '',
      fromAccountId: null,
      toAccountId: null,
      categoryId: null,
      intervalMonths: '1',
      dayOfMonth: '27',
      holidayShift: 'none',
      startDate: today,
    },
  });
  const [type, intervalMonths, dayOfMonth, holidayShift, startDate] = useWatch({
    control,
    name: ['type', 'intervalMonths', 'dayOfMonth', 'holidayShift', 'startDate'],
  });
  const txRule = TRANSACTION_RULES[type];

  useEffect(() => {
    if (rule) reset(toForm(rule));
  }, [rule, reset]);

  const changeType = (next: RuleType) => {
    if (TRANSACTION_RULES[next].categoryKind !== TRANSACTION_RULES[getValues('type')].categoryKind) {
      setValue('categoryId', null);
    }
    if (!TRANSACTION_RULES[next].from) setValue('fromAccountId', null);
    if (!TRANSACTION_RULES[next].to) setValue('toAccountId', null);
    setValue('type', next);
  };

  const onSubmit = async (values: FormValues) => {
    const t = TRANSACTION_RULES[values.type];
    try {
      await save.mutateAsync({
        id: isNew ? null : id,
        values: {
          name: values.name.trim(),
          type: values.type,
          amount: parseYen(values.amount)!,
          from_account_id: t.from ? values.fromAccountId : null,
          to_account_id: t.to ? values.toAccountId : null,
          category_id: t.categoryKind ? values.categoryId : null,
          interval_months: Number(values.intervalMonths),
          day_of_month: Number(values.dayOfMonth),
          holiday_shift: values.holidayShift,
          start_date: values.startDate,
        },
      });
      router.back();
    } catch {
      // Snackbar で知らせる
    }
  };

  const title = isNew ? '定期支払いを追加' : '定期支払いを編集';
  if (!rules.data || !accounts.data || !categories.data || (!isNew && !rule)) {
    const error = rules.error ?? accounts.error ?? categories.error;
    return (
      <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <Stack.Screen options={{ title }} />
        <QueryState
          isLoading={!error}
          error={error}
          onRetry={() => {
            rules.refetch();
            accounts.refetch();
            categories.refetch();
          }}
        />
      </View>
    );
  }

  const next = isDay(dayOfMonth)
    ? nextOccurrence(
        {
          day_of_month: Number(dayOfMonth),
          interval_months: Number(intervalMonths),
          start_date: startDate,
          holiday_shift: holidayShift,
        },
        today,
      )
    : null;
  const busy = isSubmitting || setActive.isPending || deleteGenerated.isPending || deleteRule.isPending;
  const failed = save.isError || setActive.isError || deleteGenerated.isError || deleteRule.isError;

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <Stack.Screen options={{ title }} />
      <KeyboardAwareScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        bottomOffset={24}
      >
        {rule && (
          <List.Item
            title="動かす"
            right={() => (
              <Switch
                value={rule.is_active}
                disabled={busy}
                onValueChange={(v) => setActive.mutate({ id: rule.id, isActive: v })}
              />
            )}
          />
        )}

        <Controller
          control={control}
          name="name"
          render={({ field: { onChange, onBlur, value } }) => (
            <TextInput
              mode="outlined"
              label="内容"
              value={value}
              onChangeText={onChange}
              onBlur={onBlur}
              error={!!errors.name}
            />
          )}
        />
        {!!errors.name && <HelperText type="error">{errors.name.message}</HelperText>}

        <SegmentedButtons
          value={type}
          onValueChange={(v) => changeType(v as RuleType)}
          buttons={(['expense', 'income', 'transfer'] as const).map((t) => ({
            value: t,
            label: TRANSACTION_RULES[t].label,
          }))}
        />

        <Controller
          control={control}
          name="amount"
          render={({ field: { onChange, onBlur, value } }) => (
            <TextInput
              mode="outlined"
              label="金額"
              keyboardType="number-pad"
              value={value}
              onChangeText={onChange}
              onBlur={onBlur}
              error={!!errors.amount}
              right={<TextInput.Affix text="円" />}
            />
          )}
        />
        {!!errors.amount && <HelperText type="error">{errors.amount.message}</HelperText>}

        {txRule.from && (
          <Controller
            control={control}
            name="fromAccountId"
            render={({ field: { onChange, value } }) => (
              <AccountPicker
                label={txRule.from!.label}
                kinds={txRule.from!.kinds}
                accounts={accounts.data!}
                value={value}
                onChange={onChange}
                error={errors.fromAccountId?.message}
              />
            )}
          />
        )}
        {txRule.to && (
          <Controller
            control={control}
            name="toAccountId"
            render={({ field: { onChange, value } }) => (
              <AccountPicker
                label={txRule.to!.label}
                kinds={txRule.to!.kinds}
                accounts={accounts.data!}
                value={value}
                onChange={onChange}
                error={errors.toAccountId?.message}
              />
            )}
          />
        )}
        {txRule.categoryKind && (
          <Controller
            control={control}
            name="categoryId"
            render={({ field: { onChange, value } }) => (
              <CategoryPicker
                kind={txRule.categoryKind!}
                categories={categories.data!}
                value={value}
                onChange={onChange}
                error={errors.categoryId?.message}
              />
            )}
          />
        )}

        <List.Subheader style={styles.subheader}>頻度</List.Subheader>
        <Controller
          control={control}
          name="intervalMonths"
          render={({ field: { onChange, value } }) => (
            <SegmentedButtons
              value={value}
              onValueChange={onChange}
              buttons={[
                { value: '1', label: '毎月' },
                { value: '2', label: '2か月ごと' },
              ]}
            />
          )}
        />

        <Controller
          control={control}
          name="dayOfMonth"
          render={({ field: { onChange, onBlur, value } }) => (
            <TextInput
              mode="outlined"
              label="日"
              keyboardType="number-pad"
              value={value}
              onChangeText={onChange}
              onBlur={onBlur}
              error={!!errors.dayOfMonth}
              style={styles.dayInput}
              right={<TextInput.Affix text="日" />}
            />
          )}
        />
        {!!errors.dayOfMonth && <HelperText type="error">{errors.dayOfMonth.message}</HelperText>}

        <List.Subheader style={styles.subheader}>休みの日</List.Subheader>
        <Controller
          control={control}
          name="holidayShift"
          render={({ field: { onChange, value } }) => (
            <SegmentedButtons
              value={value}
              onValueChange={onChange}
              buttons={(['none', 'before', 'after'] as const).map((s) => ({ value: s, label: SHIFT_LABELS[s] }))}
            />
          )}
        />

        <Controller
          control={control}
          name="startDate"
          render={({ field: { onChange, value } }) => <DateField value={value} onChange={onChange} />}
        />

        {next && (
          <View style={styles.row}>
            <Text variant="bodyLarge">次回</Text>
            <Text variant="titleMedium">{formatDay(next)}</Text>
          </View>
        )}

        <Button
          mode="contained"
          style={styles.button}
          onPress={() => handleSubmit(onSubmit)()}
          loading={isSubmitting}
          disabled={busy}
        >
          保存
        </Button>

        {rule && (
          <>
            <List.Section title={`追加した記録（${generated.data?.length ?? 0}件）`}>
              {generated.data?.map((t) => (
                <List.Item
                  key={t.id}
                  title={formatDay(t.date)}
                  description={t.date > today ? '予定' : undefined}
                  right={() => (
                    <Amount
                      value={t.amount}
                      kind={t.type === 'income' ? 'income' : t.type === 'expense' ? 'expense' : 'neutral'}
                      style={styles.amount}
                    />
                  )}
                  onPress={() => router.push({ pathname: '/transaction/[id]', params: { id: t.id } })}
                />
              ))}
            </List.Section>
            <Button
              mode="outlined"
              icon="delete-sweep"
              textColor={theme.colors.error}
              disabled={busy || !generated.data?.length}
              onPress={() => setConfirm('generated')}
            >
              追加した記録をまとめて削除
            </Button>
            <Button
              mode="text"
              icon="delete"
              textColor={theme.colors.error}
              style={styles.button}
              disabled={busy}
              onPress={() => setConfirm('rule')}
            >
              この定期支払いを削除
            </Button>
          </>
        )}
      </KeyboardAwareScrollView>

      <Portal>
        <Dialog visible={confirm !== null} onDismiss={() => setConfirm(null)}>
          <Dialog.Title>
            {confirm === 'generated'
              ? `追加した記録 ${generated.data?.length ?? 0}件を削除しますか？`
              : 'この定期支払いを削除しますか？'}
          </Dialog.Title>
          <Dialog.Content>
            <Text variant="bodyMedium">削除すると元に戻せません。</Text>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setConfirm(null)}>キャンセル</Button>
            <Button
              textColor={theme.colors.error}
              onPress={async () => {
                const target = confirm;
                setConfirm(null);
                try {
                  if (target === 'generated') await deleteGenerated.mutateAsync(id);
                  else {
                    await deleteRule.mutateAsync(id);
                    router.back();
                  }
                } catch {
                  // Snackbar で知らせる
                }
              }}
            >
              削除
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>

      <Snackbar
        visible={failed}
        onDismiss={() => (save.reset(), setActive.reset(), deleteGenerated.reset(), deleteRule.reset())}
      >
        保存できませんでした。通信状態を確認してください
      </Snackbar>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 16, paddingBottom: 48, gap: 8 },
  subheader: { paddingHorizontal: 0 },
  dayInput: { width: 140 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8 },
  amount: { alignSelf: 'center' },
  button: { marginTop: 8 },
});
