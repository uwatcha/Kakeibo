import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Controller, type Resolver, useForm, useWatch } from 'react-hook-form';
import { Keyboard, StyleSheet, View } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import {
  Button,
  Dialog,
  HelperText,
  IconButton,
  Portal,
  SegmentedButtons,
  Snackbar,
  Text,
  TextInput,
  useTheme,
} from 'react-native-paper';

import { ChipGroup } from '@/components/ChipGroup';
import { QueriesState } from '@/components/QueryState';
import { StatusBadge } from '@/components/StatusBadge';
import { useAccounts, useBalanceMap } from '@/features/accounts/hooks';
import { useCategories } from '@/features/categories/hooks';
import { useEmployers } from '@/features/employers/hooks';
import { findSameDayAmount, type Transaction } from '@/features/transactions/api';
import { CategoryPicker } from '@/features/transactions/components/CategoryPicker';
import { DateField } from '@/features/transactions/components/DateField';
import { recordStatus } from '@/features/transactions/confirmation';
import { AccountFields } from '@/features/transactions/form/AccountFields';
import { RepaidAdvancesField, RepaymentField } from '@/features/transactions/form/AdvanceLinks';
import { DuplicateDialog } from '@/features/transactions/form/DuplicateDialog';
import { EmployerField } from '@/features/transactions/form/EmployerField';
import { PayeeField, SUGGESTION_SPACE } from '@/features/transactions/form/PayeeField';
import { PointsSection } from '@/features/transactions/form/PointsSection';
import { useFormAssist } from '@/features/transactions/form/useFormAssist';
import {
  emptyFormValues,
  type FormValues,
  toFormValues,
  toTransactionRow,
  validateForm,
} from '@/features/transactions/form/values';
import {
  useAdvancesFor,
  useAdvancesTo,
  useCollectsFrom,
  useCreateTransaction,
  useDeleteTransaction,
  usePayeeHistory,
  useSetAdvancesRepaidBy,
  useTransaction,
  useUpdateTransaction,
} from '@/features/transactions/hooks';
import { saveLastUsedAccounts } from '@/features/transactions/lastUsedAccounts';
import { isSalaryCategory } from '@/features/transactions/salary';
import {
  OTHER_TYPES,
  PRIMARY_TYPES,
  TRANSACTION_RULES,
  type TransactionType,
} from '@/features/transactions/transactionRules';
import { toTokyoDateString } from '@/lib/date';
import { parseYen } from '@/lib/money';
import { warningColors } from '@/theme';

const OTHER = 'other';

/** 記録の入力・編集。フォームの値と確かめ方は features/transactions/form/values.ts、自動入力は useFormAssist */
export default function TransactionEditScreen() {
  const theme = useTheme();
  // 口座の利用履歴の＋から開いたときは accountId にその口座が入っている
  // ホームの「足りなくなる口座」の振替の候補から開いたときは transferFrom / transferTo / amount が入っている
  const params = useLocalSearchParams<{
    id: string;
    accountId?: string;
    transferFrom?: string;
    transferTo?: string;
    amount?: string;
  }>();
  const { id } = params;
  const isNew = id === 'new';

  const transaction = useTransaction(isNew ? undefined : id);
  const accounts = useAccounts();
  const balances = useBalanceMap();
  const categories = useCategories();
  const create = useCreateTransaction();
  const update = useUpdateTransaction();
  const remove = useDeleteTransaction();
  const setRepaid = useSetAdvancesRepaidBy();
  const payeeHistory = usePayeeHistory();
  const employers = useEmployers();
  const [confirmDelete, setConfirmDelete] = useState(false);

  const resolver: Resolver<FormValues> = (values) => {
    const entries = Object.entries(validateForm(values, accounts.data ?? [], categories.data ?? []));
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
  } = useForm<FormValues>({ resolver, defaultValues: emptyFormValues(toTokyoDateString()) });
  const type = useWatch({ control, name: 'type' });
  const rule = TRANSACTION_RULES[type];
  const fromAccountId = useWatch({ control, name: 'fromAccountId' });
  const categoryId = useWatch({ control, name: 'categoryId' });
  const date = useWatch({ control, name: 'date' });
  const toAccountId = useWatch({ control, name: 'toAccountId' });
  // 立て替え ↔ 貸し金戻り: 立て替えは相手（入金先）からの貸し金戻りを、貸し金戻りは相手（出金元）への立て替えを候補にする
  const collects = useCollectsFrom(toAccountId, date, type === 'advance');
  const advancesTo = useAdvancesTo(fromAccountId, type === 'collect');
  const linkedAdvances = useAdvancesFor(isNew ? undefined : id);
  const isSalary = isSalaryCategory(categoryId, categories.data ?? []);

  const assist = useFormAssist({
    isNew,
    accounts: accounts.data,
    employers: employers.data ?? [],
    type,
    fromAccountId,
    getValues,
    setValue,
    presetAccountId: params.accountId,
    presetTransfer: { from: params.transferFrom, to: params.transferTo, amount: params.amount },
  });

  // 編集: 保存済みの記録をフォームに入れる
  useEffect(() => {
    if (transaction.data) reset(toFormValues(transaction.data));
  }, [transaction.data, reset]);
  // 貸し金戻りで返してもらった立て替えは立て替えの側に書いてあるので、読み込めたら1回だけ入れる
  const repaidFilled = useRef(false);
  useEffect(() => {
    if (!transaction.data || !linkedAdvances.data || repaidFilled.current) return;
    repaidFilled.current = true;
    setValue(
      'repaidAdvanceIds',
      linkedAdvances.data.map((t) => t.id),
    );
  }, [transaction.data, linkedAdvances.data, setValue]);

  // 新しい記録で同じ日・同じ金額の記録があれば、保存する前に確かめる（REQ-17）
  const [duplicate, setDuplicate] = useState<{ values: FormValues; matches: Transaction[] } | null>(null);

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
    const row = toTransactionRow(values, categories.data ?? [], toTokyoDateString());
    try {
      let savedId = id;
      if (isNew) {
        savedId = await create.mutateAsync(row);
        await saveLastUsedAccounts(values.type, { fromAccountId: row.from_account_id, toAccountId: row.to_account_id });
      } else {
        await update.mutateAsync({ id, values: row });
      }
      // 貸し金戻りで返してもらった立て替え（種類を変えたら、つないであったものを外す）
      if (values.type === 'collect' && (isNew ? values.repaidAdvanceIds.length > 0 : true)) {
        await setRepaid.mutateAsync({ collectId: savedId, advanceIds: values.repaidAdvanceIds });
      } else if (!isNew && (linkedAdvances.data?.length ?? 0) > 0) {
        await setRepaid.mutateAsync({ collectId: savedId, advanceIds: [] });
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
    return (
      <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <Stack.Screen options={{ title }} />
        <QueriesState queries={[accounts, categories, ...(isNew ? [] : [transaction])]} />
      </View>
    );
  }

  const saving = isSubmitting || remove.isPending;
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
        bottomOffset={24 + SUGGESTION_SPACE}
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
          onValueChange={(v) => {
              // キーボードを閉じて、同じタップで種類を切り替える
              Keyboard.dismiss();
              assist.changeType(v === OTHER ? 'advance' : (v as TransactionType));
            }}
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
            onChange={(v) => v && assist.changeType(v as TransactionType)}
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
                onValueChange={(v) => {
                  Keyboard.dismiss();
                  onChange(v);
                }}
                buttons={[
                  { value: 'increase', label: '残高を増やす', icon: 'plus' },
                  { value: 'decrease', label: '残高を減らす', icon: 'minus' },
                ]}
              />
            )}
          />
        )}

        <AccountFields control={control} errors={errors} type={type} accounts={accountList} balances={balances} />

        {rule.categoryKind && (
          <Controller
            control={control}
            name="categoryId"
            render={({ field: { onChange, value } }) => (
              <CategoryPicker
                rows={2}
                kind={rule.categoryKind!}
                categories={categories.data!}
                value={value}
                onChange={(next) => {
                  assist.markCategoryChosen();
                  onChange(next);
                }}
                error={errors.categoryId?.message}
              />
            )}
          />
        )}

        {/* 給与・アルバイトの収入では、収入元（働き先）を必ず選ぶ */}
        {type === 'income' && isSalary && (
          <EmployerField
            control={control}
            errors={errors}
            employers={employers.data ?? []}
            onPick={assist.fillFromEmployer}
          />
        )}

        {type === 'advance' && <RepaymentField control={control} collects={collects.data ?? []} />}
        {type === 'collect' && (
          <RepaidAdvancesField control={control} advances={advancesTo.data ?? []} collectId={isNew ? null : id} />
        )}

        <Controller
          control={control}
          name="date"
          render={({ field: { onChange, value } }) => <DateField value={value} onChange={onChange} />}
        />
        {!!errors.date && <HelperText type="error">{errors.date.message}</HelperText>}

        <PayeeField control={control} history={payeeHistory.data ?? []} onCommit={assist.fillCategoryFromPayee} />
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

        <PointsSection
          control={control}
          errors={errors}
          initiallyOpen={
            !!transaction.data && (transaction.data.list_price !== null || transaction.data.points_used !== null)
          }
        />

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
        <DuplicateDialog
          matches={duplicate?.matches ?? null}
          onCancel={() => setDuplicate(null)}
          onSave={() => {
            // `duplicate!.values` と書くと、React Compiler が描画のたびに duplicate.values を読むようになり、
            // duplicate が null の間（ふだん）に落ちる。null を確かめてから読む
            if (!duplicate) return;
            setDuplicate(null);
            onSubmit(duplicate.values, true);
          }}
        />
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
        visible={create.isError || update.isError || remove.isError || setRepaid.isError}
        onDismiss={() => (create.reset(), update.reset(), remove.reset(), setRepaid.reset())}
      >
        保存できませんでした。通信状態を確認してください
      </Snackbar>
    </View>
  );
}

const styles = StyleSheet.create({
  confirmBar: { flexDirection: 'row', alignItems: 'center', borderRadius: 16, padding: 8, paddingLeft: 12 },
  confirmSpacer: { flex: 1 },
  container: { flex: 1 },
  content: { padding: 16, paddingBottom: 48, gap: 12 },
  amount: { fontSize: 24 },
  save: { marginTop: 8 },
});
