import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Controller, type Resolver, useForm, type UseFormSetValue, useWatch } from 'react-hook-form';
import { StyleSheet, View } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import {
  Button,
  Dialog,
  HelperText,
  IconButton,
  List,
  Portal,
  SegmentedButtons,
  Snackbar,
  Text,
  TextInput,
  useTheme,
} from 'react-native-paper';

import { ChipGroup } from '@/components/ChipGroup';
import { QueryState } from '@/components/QueryState';
import { StatusBadge } from '@/components/StatusBadge';
import { useAccounts } from '@/features/accounts/hooks';
import { useCategories } from '@/features/categories/hooks';
import { fetchCategoryHistory, findSameDayAmount, type Transaction } from '@/features/transactions/api';
import { guessCategory } from '@/features/transactions/categoryGuess';
import { isConfirmedOnSave, recordStatus } from '@/features/transactions/confirmation';
import { AccountPicker } from '@/features/transactions/components/AccountPicker';
import { CategoryPicker } from '@/features/transactions/components/CategoryPicker';
import { DateField } from '@/features/transactions/components/DateField';
import {
  useCreateTransaction,
  useDeleteTransaction,
  useTransaction,
  useUpdateTransaction,
} from '@/features/transactions/hooks';
import { loadLastUsedAccounts, saveLastUsedAccounts } from '@/features/transactions/lastUsedAccounts';
import {
  type AdjustmentDirection,
  type DraftErrors,
  normalizeAccounts,
  OTHER_TYPES,
  PRIMARY_TYPES,
  TRANSACTION_RULES,
  type TransactionType,
  validateDraft,
} from '@/features/transactions/transactionRules';
import { formatDay, toTokyoDateString } from '@/lib/date';
import { formatYen, parseNonNegativeYen, parseYen } from '@/lib/money';
import { warningColors } from '@/theme';

type FormValues = {
  type: TransactionType;
  amount: string;
  fromAccountId: string | null;
  toAccountId: string | null;
  adjustmentDirection: AdjustmentDirection;
  categoryId: string | null;
  date: string;
  payee: string;
  memo: string;
  /** 本来の金額・利用ポイント（REQ-18）。空欄なら記録しない */
  listPrice: string;
  pointsUsed: string;
};

const OTHER = 'other';

type LastUsed = Awaited<ReturnType<typeof loadLastUsedAccounts>>;

/** その種類で前回使った口座をフォームに入れる。残高調整は口座を fromAccountId にまとめて持つ */
function applyLastUsed(setValue: UseFormSetValue<FormValues>, type: TransactionType, saved: LastUsed) {
  const from = saved[type]?.fromAccountId ?? null;
  const to = saved[type]?.toAccountId ?? null;
  setValue('fromAccountId', type === 'adjustment' ? (from ?? to) : from);
  setValue('toAccountId', type === 'adjustment' ? null : to);
}

export default function TransactionEditScreen() {
  const theme = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const isNew = id === 'new';

  const transaction = useTransaction(isNew ? undefined : id);
  const accounts = useAccounts();
  const categories = useCategories();
  const create = useCreateTransaction();
  const update = useUpdateTransaction();
  const remove = useDeleteTransaction();
  const [confirmDelete, setConfirmDelete] = useState(false);
  // 「ポイント」は、保存済みの値があれば最初から開いておく。押したら押した方を優先
  const [pointsOpen, setPointsOpen] = useState<boolean | null>(null);

  // 種類ごとのルール（transactionRules.ts）で確かめる
  const resolver: Resolver<FormValues> = (values) => {
    const errors: DraftErrors & { listPrice?: string; pointsUsed?: string } = validateDraft(
      { ...values, amount: parseYen(values.amount) },
      accounts.data ?? [],
      categories.data ?? [],
    );
    if (values.listPrice.trim() !== '' && parseNonNegativeYen(values.listPrice) === null) {
      errors.listPrice = '0以上の整数（円）で入力してください';
    }
    if (values.pointsUsed.trim() !== '' && parseNonNegativeYen(values.pointsUsed) === null) {
      errors.pointsUsed = '0以上の整数で入力してください';
    }
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
      type: 'expense',
      amount: '',
      fromAccountId: null,
      toAccountId: null,
      adjustmentDirection: 'increase',
      categoryId: null,
      date: toTokyoDateString(),
      payee: '',
      memo: '',
      listPrice: '',
      pointsUsed: '',
    },
  });
  const type = useWatch({ control, name: 'type' });
  const rule = TRANSACTION_RULES[type];

  // 編集: 保存済みの記録をフォームに入れる
  useEffect(() => {
    const t = transaction.data;
    if (!t) return;
    reset({
      type: t.type,
      amount: String(t.amount),
      // 残高調整は口座を fromAccountId にまとめて持ち、保存時に向きで振り分ける（normalizeAccounts）
      fromAccountId: t.type === 'adjustment' ? (t.from_account_id ?? t.to_account_id) : t.from_account_id,
      toAccountId: t.type === 'adjustment' ? null : t.to_account_id,
      adjustmentDirection: t.type === 'adjustment' && t.from_account_id ? 'decrease' : 'increase',
      categoryId: t.category_id,
      date: t.date,
      payee: t.payee ?? '',
      memo: t.memo ?? '',
      listPrice: t.list_price === null ? '' : String(t.list_price),
      pointsUsed: t.points_used === null ? '' : String(t.points_used),
    });
  }, [transaction.data, reset]);

  // 新規: 種類を選ぶたびに、その種類で前回使った口座を初期値にする（REQ-30）
  const lastUsed = useRef<LastUsed>({});
  useEffect(() => {
    if (!isNew) return;
    loadLastUsedAccounts().then((saved) => {
      lastUsed.current = saved;
      applyLastUsed(setValue, getValues('type'), saved);
    });
  }, [isNew, getValues, setValue]);

  const changeType = (next: TransactionType) => {
    if (TRANSACTION_RULES[next].categoryKind !== TRANSACTION_RULES[getValues('type')].categoryKind) {
      setValue('categoryId', null);
    }
    setValue('type', next);
    if (isNew) applyLastUsed(setValue, next, lastUsed.current);
  };

  // 新しい記録で同じ日・同じ金額の記録があれば、保存する前に確かめる（REQ-17）
  const [duplicate, setDuplicate] = useState<{ values: FormValues; matches: Transaction[] } | null>(null);

  // カテゴリが空のまま内容を入れたら、同じ内容の過去の記録でいちばん多いカテゴリを入れる（REQ-8）
  const fillCategoryFromHistory = async (payee: string) => {
    const currentType = getValues('type');
    if (!TRANSACTION_RULES[currentType].categoryKind || getValues('categoryId') || payee.trim() === '') return;
    try {
      const guessed = guessCategory(await fetchCategoryHistory(payee.trim(), currentType));
      if (guessed && !getValues('categoryId') && getValues('type') === currentType) setValue('categoryId', guessed);
    } catch {
      // 予測できなくても入力は続けられる
    }
  };

  const onSubmit = async (values: FormValues, skipDuplicateCheck = false) => {
    if (isNew && !skipDuplicateCheck) {
      try {
        const matches = await findSameDayAmount(values.date, parseYen(values.amount)!);
        if (matches.length > 0) {
          setDuplicate({ values, matches });
          return;
        }
      } catch {
        // 確かめられなくても保存は続ける
      }
    }
    const { fromAccountId, toAccountId } = normalizeAccounts({ ...values, amount: parseYen(values.amount) });
    const row = {
      type: values.type,
      amount: parseYen(values.amount)!,
      from_account_id: fromAccountId,
      to_account_id: toAccountId,
      category_id: TRANSACTION_RULES[values.type].categoryKind ? values.categoryId : null,
      date: values.date,
      payee: values.payee.trim() || null,
      memo: values.memo.trim() || null,
      list_price: values.listPrice.trim() === '' ? null : parseNonNegativeYen(values.listPrice),
      points_used: values.pointsUsed.trim() === '' ? null : parseNonNegativeYen(values.pointsUsed),
      is_confirmed: isConfirmedOnSave(values.date, toTokyoDateString()),
    };
    try {
      if (isNew) {
        await create.mutateAsync(row);
        await saveLastUsedAccounts(values.type, { fromAccountId, toAccountId });
      } else {
        await update.mutateAsync({ id, values: row });
      }
      router.back();
    } catch {
      // Snackbar で知らせる
    }
  };

  const onConfirm = async () => {
    try {
      await update.mutateAsync({ id, values: { is_confirmed: true } });
      router.back();
    } catch {
      // Snackbar で知らせる
    }
  };

  const onDelete = async () => {
    setConfirmDelete(false);
    try {
      await remove.mutateAsync(id);
      router.back();
    } catch {
      // Snackbar で知らせる
    }
  };

  const title = isNew ? '記録する' : '記録を編集';
  const loading = !accounts.data || !categories.data || (!isNew && !transaction.data);
  if (loading) {
    const failed = accounts.error ?? categories.error ?? transaction.error;
    return (
      <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <Stack.Screen options={{ title }} />
        <QueryState
          isLoading={!failed}
          error={failed}
          onRetry={() => {
            accounts.refetch();
            categories.refetch();
            if (!isNew) transaction.refetch();
          }}
        />
      </View>
    );
  }

  const saving = isSubmitting || remove.isPending;
  const pointsExpanded =
    pointsOpen ??
    (transaction.data ? transaction.data.list_price !== null || transaction.data.points_used !== null : false);
  const accountList = accounts.data!;

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <Stack.Screen
        options={{
          title,
          headerRight: isNew
            ? undefined
            : () => (
                <IconButton
                  icon="delete"
                  accessibilityLabel="削除"
                  onPress={() => setConfirmDelete(true)}
                  disabled={saving}
                />
              ),
        }}
      />
      <KeyboardAwareScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        bottomOffset={24}
      >
        {transaction.data && recordStatus(transaction.data, toTokyoDateString()) === 'unconfirmed' && (
          <View style={[styles.confirmBar, { backgroundColor: warningColors(theme.dark).background }]}>
            <StatusBadge status="unconfirmed" />
            <View style={styles.confirmSpacer} />
            <Button mode="contained" icon="check" onPress={onConfirm} loading={update.isPending} disabled={saving}>
              確認した
            </Button>
          </View>
        )}
        {transaction.data?.recurring_rule_id && (
          <Button
            mode="outlined"
            icon="autorenew"
            onPress={() =>
              router.push({ pathname: '/recurring/[id]', params: { id: transaction.data!.recurring_rule_id! } })
            }
          >
            定期支払い: {transaction.data.payee ?? ''}
          </Button>
        )}
        <SegmentedButtons
          value={PRIMARY_TYPES.includes(type) ? type : OTHER}
          onValueChange={(v) => changeType(v === OTHER ? 'advance' : (v as TransactionType))}
          buttons={[
            ...PRIMARY_TYPES.map((t) => ({ value: t, label: TRANSACTION_RULES[t].label })),
            { value: OTHER, label: 'その他' },
          ]}
        />
        {!PRIMARY_TYPES.includes(type) && (
          <ChipGroup
            options={OTHER_TYPES.map((t) => ({
              value: t,
              label: TRANSACTION_RULES[t].label,
              icon: TRANSACTION_RULES[t].icon,
            }))}
            value={type}
            onChange={(v) => v && changeType(v as TransactionType)}
          />
        )}

        <Controller
          control={control}
          name="amount"
          render={({ field: { onChange, onBlur, value } }) => (
            <TextInput
              mode="outlined"
              label="金額"
              keyboardType="number-pad"
              autoFocus={isNew}
              value={value}
              onChangeText={onChange}
              onBlur={onBlur}
              error={!!errors.amount}
              style={styles.amount}
              right={<TextInput.Affix text="円" />}
            />
          )}
        />
        {!!errors.amount && <HelperText type="error">{errors.amount.message}</HelperText>}

        {type === 'adjustment' && (
          <Controller
            control={control}
            name="adjustmentDirection"
            render={({ field: { onChange, value } }) => (
              <SegmentedButtons
                value={value}
                onValueChange={onChange}
                buttons={[
                  { value: 'increase', label: '残高を増やす', icon: 'plus' },
                  { value: 'decrease', label: '残高を減らす', icon: 'minus' },
                ]}
              />
            )}
          />
        )}

        {type === 'adjustment' ? (
          <Controller
            control={control}
            name="fromAccountId"
            render={({ field: { onChange, value } }) => (
              <AccountPicker
                label="口座"
                kinds={rule.from!.kinds}
                accounts={accountList}
                value={value}
                onChange={onChange}
                error={errors.fromAccountId?.message ?? errors.toAccountId?.message}
              />
            )}
          />
        ) : (
          <>
            {rule.from && (
              <Controller
                control={control}
                name="fromAccountId"
                render={({ field: { onChange, value } }) => (
                  <AccountPicker
                    label={rule.from!.label}
                    kinds={rule.from!.kinds}
                    accounts={accountList}
                    value={value}
                    onChange={onChange}
                    error={errors.fromAccountId?.message}
                  />
                )}
              />
            )}
            {rule.to && (
              <Controller
                control={control}
                name="toAccountId"
                render={({ field: { onChange, value } }) => (
                  <AccountPicker
                    label={rule.to!.label}
                    kinds={rule.to!.kinds}
                    accounts={accountList}
                    value={value}
                    onChange={onChange}
                    error={errors.toAccountId?.message}
                  />
                )}
              />
            )}
          </>
        )}

        {rule.categoryKind && (
          <Controller
            control={control}
            name="categoryId"
            render={({ field: { onChange, value } }) => (
              <CategoryPicker
                kind={rule.categoryKind!}
                categories={categories.data!}
                value={value}
                onChange={onChange}
                error={errors.categoryId?.message}
              />
            )}
          />
        )}

        <Controller
          control={control}
          name="date"
          render={({ field: { onChange, value } }) => <DateField value={value} onChange={onChange} />}
        />
        {!!errors.date && <HelperText type="error">{errors.date.message}</HelperText>}

        <Controller
          control={control}
          name="payee"
          render={({ field: { onChange, onBlur, value } }) => (
            <TextInput
              mode="outlined"
              label="内容（任意）"
              value={value}
              onChangeText={onChange}
              onBlur={() => {
                onBlur();
                fillCategoryFromHistory(value);
              }}
            />
          )}
        />
        <Controller
          control={control}
          name="memo"
          render={({ field: { onChange, onBlur, value } }) => (
            <TextInput
              mode="outlined"
              label="メモ（任意）"
              value={value}
              onChangeText={onChange}
              onBlur={onBlur}
              multiline
            />
          )}
        />

        <List.Accordion
          title="ポイント"
          left={(props) => <List.Icon {...props} icon="ticket-percent" />}
          expanded={pointsExpanded}
          onPress={() => setPointsOpen(!pointsExpanded)}
          style={styles.accordion}
        >
          <View style={styles.pointsRow}>
            {(
              [
                ['listPrice', '本来の金額'],
                ['pointsUsed', '利用ポイント'],
              ] as const
            ).map(([name, label]) => (
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
                    style={styles.pointsInput}
                  />
                )}
              />
            ))}
          </View>
          {!!(errors.listPrice ?? errors.pointsUsed) && (
            <HelperText type="error">{(errors.listPrice ?? errors.pointsUsed)?.message}</HelperText>
          )}
        </List.Accordion>

        <Button
          mode="contained"
          style={styles.save}
          onPress={() => handleSubmit((values) => onSubmit(values))()}
          loading={isSubmitting}
          disabled={saving}
        >
          保存
        </Button>
      </KeyboardAwareScrollView>

      <Portal>
        <Dialog visible={duplicate !== null} onDismiss={() => setDuplicate(null)}>
          <Dialog.Title>同じ日・同じ金額の記録があります</Dialog.Title>
          <Dialog.Content>
            {duplicate?.matches.map((m) => (
              <Text key={m.id} variant="bodyMedium">
                {formatDay(m.date)} {TRANSACTION_RULES[m.type].label} {formatYen(m.amount)}
                {m.payee ? `（${m.payee}）` : ''}
              </Text>
            ))}
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setDuplicate(null)}>やめる</Button>
            <Button
              onPress={() => {
                const values = duplicate!.values;
                setDuplicate(null);
                onSubmit(values, true);
              }}
            >
              保存する
            </Button>
          </Dialog.Actions>
        </Dialog>
        <Dialog visible={confirmDelete} onDismiss={() => setConfirmDelete(false)}>
          <Dialog.Title>この記録を削除しますか？</Dialog.Title>
          <Dialog.Content>
            <Text variant="bodyMedium">削除すると元に戻せません。</Text>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setConfirmDelete(false)}>キャンセル</Button>
            <Button onPress={onDelete} textColor={theme.colors.error}>
              削除
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>

      <Snackbar
        visible={create.isError || update.isError || remove.isError}
        onDismiss={() => (create.reset(), update.reset(), remove.reset())}
      >
        保存できませんでした。通信状態を確認してください
      </Snackbar>
    </View>
  );
}

const styles = StyleSheet.create({
  confirmBar: { flexDirection: 'row', alignItems: 'center', borderRadius: 16, padding: 8, paddingLeft: 12 },
  confirmSpacer: { flex: 1 },
  accordion: { paddingHorizontal: 0 },
  pointsRow: { flexDirection: 'row', gap: 8 },
  pointsInput: { flex: 1 },
  container: { flex: 1 },
  content: { padding: 16, paddingBottom: 48, gap: 12 },
  amount: { fontSize: 24 },
  save: { marginTop: 8 },
});
