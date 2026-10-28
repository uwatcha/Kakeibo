import { useState } from 'react';
import { Controller, type Resolver, useForm, useWatch } from 'react-hook-form';
import { BackHandler, Keyboard, Linking, StyleSheet, View } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import { Button, HelperText, Portal, SegmentedButtons, Snackbar, Text, TextInput, useTheme } from 'react-native-paper';

import { ChipGroup } from '@/components/ChipGroup';
import { useAccounts, useBalanceMap } from '@/features/accounts/hooks';
import { useCategories } from '@/features/categories/hooks';
import { useEmployers } from '@/features/employers/hooks';
import { findSameDayAmount, type Transaction } from '@/features/transactions/api';
import { CategoryPicker } from '@/features/transactions/components/CategoryPicker';
import { AccountFields } from '@/features/transactions/form/AccountFields';
import { DuplicateDialog } from '@/features/transactions/form/DuplicateDialog';
import { EmployerField } from '@/features/transactions/form/EmployerField';
import { PayeeField, SUGGESTION_SPACE } from '@/features/transactions/form/PayeeField';
import { useFormAssist } from '@/features/transactions/form/useFormAssist';
import { emptyFormValues, type FormValues, toTransactionRow, validateForm } from '@/features/transactions/form/values';
import { useCreateTransaction, usePayeeHistory } from '@/features/transactions/hooks';
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
import { RADIUS, SPACING } from '@/theme';

const OTHER = 'other';

/** この画面を閉じてホーム画面に戻る（QuickAddActivity が閉じる） */
export const closeQuick = () => BackHandler.exitApp();

/**
 * ウィジェットの「記録」から出す、ホーム画面の上の入力シート（要件 REQ-15）。
 * 欄は金額（最初からキーボード）・種類（すべて）・口座・カテゴリ・内容。日付は今日。
 * フォームの値・確かめ方・自動入力は記録の入力画面（src/app/transaction/[id].tsx）と同じ部品を使う
 */
export function QuickEntrySheet() {
  const theme = useTheme();
  const accounts = useAccounts();
  const balances = useBalanceMap();
  const categories = useCategories();
  const employers = useEmployers();
  const payeeHistory = usePayeeHistory();
  const create = useCreateTransaction();
  const [duplicate, setDuplicate] = useState<{ values: FormValues; matches: Transaction[] } | null>(null);

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
    setValue,
    getValues,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver, defaultValues: emptyFormValues(toTokyoDateString()) });
  const type = useWatch({ control, name: 'type' });
  const fromAccountId = useWatch({ control, name: 'fromAccountId' });
  const categoryId = useWatch({ control, name: 'categoryId' });
  const rule = TRANSACTION_RULES[type];
  const assist = useFormAssist({
    isNew: true,
    accounts: accounts.data,
    employers: employers.data ?? [],
    type,
    fromAccountId,
    getValues,
    setValue,
  });

  const save = async (values: FormValues, skipDuplicateCheck = false) => {
    if (!skipDuplicateCheck) {
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
      await create.mutateAsync(row);
      await saveLastUsedAccounts(values.type, { fromAccountId: row.from_account_id, toAccountId: row.to_account_id });
      closeQuick();
    } catch {
      // Snackbar で知らせる
    }
  };

  const ready = accounts.data && categories.data;

  return (
    <View style={[styles.sheet, { backgroundColor: theme.colors.background }]}>
      <View style={[styles.handle, { backgroundColor: theme.colors.outlineVariant }]} />
      {!ready ? (
        <Text variant="bodyMedium" style={[styles.loading, { color: theme.colors.onSurfaceVariant }]}>
          読み込んでいます…
        </Text>
      ) : (
        <KeyboardAwareScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          bottomOffset={16 + SUGGESTION_SPACE}
        >
          <Controller
            control={control}
            name="amount"
            render={({ field: { onChange, onBlur, value } }) => (
              <TextInput
                mode="outlined"
                label="金額"
                keyboardType="number-pad"
                autoFocus
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

          <AccountFields control={control} errors={errors} type={type} accounts={accounts.data!} balances={balances} />

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
          {type === 'income' && isSalaryCategory(categoryId, categories.data!) && (
            <EmployerField
              control={control}
              errors={errors}
              employers={employers.data ?? []}
              onPick={assist.fillFromEmployer}
            />
          )}

          <PayeeField control={control} history={payeeHistory.data ?? []} onCommit={assist.fillCategoryFromPayee} />

          <View style={styles.actions}>
            <Button
              onPress={() => {
                Linking.openURL('kakeibo://transaction/new');
                closeQuick();
              }}
            >
              詳しく入力
            </Button>
            <Button
              mode="contained"
              onPress={() => handleSubmit((values) => save(values))()}
              loading={isSubmitting}
              disabled={isSubmitting}
              style={styles.save}
            >
              保存
            </Button>
          </View>
        </KeyboardAwareScrollView>
      )}

      <Portal>
        <DuplicateDialog
          matches={duplicate?.matches ?? null}
          onCancel={() => setDuplicate(null)}
          onSave={() => {
            // null を確かめてから読む（React Compiler が描画時に読まないように。CLAUDE.md）
            if (!duplicate) return;
            setDuplicate(null);
            save(duplicate.values, true);
          }}
        />
      </Portal>
      <Snackbar visible={create.isError} onDismiss={create.reset}>
        保存できませんでした。通信状態を確認してください
      </Snackbar>
    </View>
  );
}

const styles = StyleSheet.create({
  sheet: {
    maxHeight: '88%',
    borderTopLeftRadius: RADIUS.card,
    borderTopRightRadius: RADIUS.card,
    paddingTop: 8,
  },
  handle: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, marginBottom: 4 },
  loading: { padding: 32, textAlign: 'center' },
  content: { padding: SPACING.screen, gap: 12, paddingBottom: 24 },
  amount: { fontSize: 24 },
  actions: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 },
  save: { minWidth: 120 },
});
