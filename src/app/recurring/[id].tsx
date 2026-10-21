import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect } from 'react';
import { Controller, type Resolver, useForm, useWatch } from 'react-hook-form';
import { StyleSheet, View } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import {
  Button,
  HelperText,
  List,
  SegmentedButtons,
  Snackbar,
  Switch,
  Text,
  TextInput,
  useTheme,
} from 'react-native-paper';

import { QueryState } from '@/components/QueryState';
import { useAccounts, useBalanceMap } from '@/features/accounts/hooks';
import { useCategories } from '@/features/categories/hooks';
import { GeneratedRecords } from '@/features/recurring/components/GeneratedRecords';
import {
  emptyRuleForm,
  isDayOfMonth,
  type RuleFormValues,
  type RuleType,
  toRuleForm,
  toRuleRow,
  validateRuleForm,
} from '@/features/recurring/formValues';
import { useGeneratedTransactions, useRules, useSaveRule, useSetRuleActive } from '@/features/recurring/hooks';
import { SHIFT_LABELS } from '@/features/recurring/labels';
import { nextOccurrence } from '@/features/recurring/schedule';
import { AccountPicker } from '@/features/transactions/components/AccountPicker';
import { CategoryPicker } from '@/features/transactions/components/CategoryPicker';
import { DateField } from '@/features/transactions/components/DateField';
import { TRANSACTION_RULES } from '@/features/transactions/transactionRules';
import { formatDay, toTokyoDateString } from '@/lib/date';

export default function RecurringRuleScreen() {
  const theme = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const isNew = id === 'new';
  const today = toTokyoDateString();

  const rules = useRules();
  const accounts = useAccounts();
  const balances = useBalanceMap();
  const categories = useCategories();
  const generated = useGeneratedTransactions(isNew ? undefined : id);
  const save = useSaveRule();
  const setActive = useSetRuleActive();

  const rule = rules.data?.find((r) => r.id === id);

  const resolver: Resolver<RuleFormValues> = (values) => {
    const entries = Object.entries(validateRuleForm(values, accounts.data ?? [], categories.data ?? []));
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
  } = useForm<RuleFormValues>({ resolver, defaultValues: emptyRuleForm(today) });
  const [type, intervalMonths, dayOfMonth, holidayShift, startDate] = useWatch({
    control,
    name: ['type', 'intervalMonths', 'dayOfMonth', 'holidayShift', 'startDate'],
  });
  const txRule = TRANSACTION_RULES[type];

  useEffect(() => {
    if (rule) reset(toRuleForm(rule));
  }, [rule, reset]);

  const changeType = (next: RuleType) => {
    if (TRANSACTION_RULES[next].categoryKind !== TRANSACTION_RULES[getValues('type')].categoryKind) {
      setValue('categoryId', null);
    }
    if (!TRANSACTION_RULES[next].from) setValue('fromAccountId', null);
    if (!TRANSACTION_RULES[next].to) setValue('toAccountId', null);
    setValue('type', next);
  };

  const onSubmit = async (values: RuleFormValues) => {
    try {
      await save.mutateAsync({ id: isNew ? null : id, values: toRuleRow(values) });
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

  const next = isDayOfMonth(dayOfMonth)
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
  const busy = isSubmitting || setActive.isPending;
  const failed = save.isError || setActive.isError;

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
                balances={balances}
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
                balances={balances}
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

        {rule && <GeneratedRecords ruleId={rule.id} generated={generated.data} today={today} busy={busy} />}
      </KeyboardAwareScrollView>

      <Snackbar visible={failed} onDismiss={() => (save.reset(), setActive.reset())}>
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
  button: { marginTop: 8 },
});
