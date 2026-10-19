import { zodResolver } from '@hookform/resolvers/zod';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { StyleSheet, View } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import { Button, HelperText, List, RadioButton, Snackbar, Switch, TextInput, useTheme } from 'react-native-paper';
import { z } from 'zod';

import { QueryState } from '@/components/QueryState';
import {
  ACCOUNT_KIND_INFO,
  ACCOUNT_KINDS,
  ASSET_KINDS,
  fromOpeningBalance,
  toOpeningBalance,
} from '@/features/accounts/accountKinds';
import { planAdjustment } from '@/features/accounts/adjustment';
import { useAccount, useAccountBalance, useCreateAccount, useUpdateAccount } from '@/features/accounts/hooks';
import { useCategories } from '@/features/categories/hooks';
import { CategoryPicker } from '@/features/transactions/components/CategoryPicker';
import { useCreateTransaction } from '@/features/transactions/hooks';
import { toTokyoDateString } from '@/lib/date';
import { parseNonNegativeYen } from '@/lib/money';

const schema = z.object({
  name: z.string().trim().min(1, '名前を入力してください').max(50, '50文字以内にしてください'),
  kind: z.enum(ACCOUNT_KINDS as [string, ...string[]]),
  openingBalance: z.string().refine((v) => parseNonNegativeYen(v) !== null, '0以上の整数（円）で入力してください'),
  isReserved: z.boolean(),
  defaultCategoryId: z.string().nullable(),
});

type FormValues = z.infer<typeof schema>;
type Kind = (typeof ACCOUNT_KINDS)[number];

/** 支払いに使える口座（既定のカテゴリを持てる） */
const canPay = (kind: Kind) => ASSET_KINDS.includes(kind) || kind === 'credit_card';

export default function AccountEditScreen() {
  const theme = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const isNew = id === 'new';

  const account = useAccount(isNew ? undefined : id);
  // 編集では残高の欄に今日までの残高を出し、変えたら差額を残高調整として記録する
  const balance = useAccountBalance(isNew ? undefined : id);
  const categories = useCategories();
  const createTransaction = useCreateTransaction();
  const create = useCreateAccount();
  const update = useUpdateAccount();

  const {
    control,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { name: '', kind: 'cash', openingBalance: '', isReserved: false, defaultCategoryId: null },
  });
  const kind = useWatch({ control, name: 'kind' }) as Kind;

  useEffect(() => {
    if (account.data && balance.data !== undefined) {
      reset({
        name: account.data.name,
        kind: account.data.kind,
        openingBalance: String(fromOpeningBalance(account.data.kind, balance.data)),
        isReserved: account.data.is_reserved,
        defaultCategoryId: account.data.default_category_id,
      });
    }
  }, [account.data, balance.data, reset]);

  const onSubmit = async (values: FormValues) => {
    const valuesKind = values.kind as Kind;
    const input = parseNonNegativeYen(values.openingBalance) ?? 0;
    const common = {
      name: values.name,
      // 普段使わない口座の区別は資産の口座だけ
      is_reserved: ASSET_KINDS.includes(valuesKind) && values.isReserved,
      default_category_id: canPay(valuesKind) ? values.defaultCategoryId : null,
    };
    try {
      if (isNew) {
        await create.mutateAsync({
          ...common,
          opening_balance: toOpeningBalance(valuesKind, input),
          kind: valuesKind,
          // 作るときだけ、普段使わない口座は汎用資産に含めない状態から始める（あとはホームの ⚙ で切り替える）
          include_in_available: !common.is_reserved,
        });
      } else {
        await update.mutateAsync({ id, values: common });
        // 残高を変えたら、差額を今日の残高調整として記録する（初期残高は変えない）
        const plan = planAdjustment(valuesKind, balance.data ?? 0, input);
        if (plan) {
          await createTransaction.mutateAsync({
            type: 'adjustment',
            amount: plan.amount,
            from_account_id: plan.direction === 'decrease' ? id : null,
            to_account_id: plan.direction === 'increase' ? id : null,
            date: toTokyoDateString(),
            payee: '残高を合わせる',
          });
        }
      }
      router.back();
    } catch {
      // 失敗は Snackbar で知らせる（create / update の isError）
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

  const title = isNew ? '口座を追加' : '口座を編集';

  if ((!isNew && (!account.data || balance.data === undefined)) || !categories.data) {
    const error = account.error ?? balance.error ?? categories.error;
    return (
      <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <Stack.Screen options={{ title }} />
        <QueryState
          isLoading={!error}
          error={error}
          onRetry={() => {
            account.refetch();
            balance.refetch();
            categories.refetch();
          }}
        />
      </View>
    );
  }

  const saving = isSubmitting || update.isPending || createTransaction.isPending;

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
              label="名前（例: 財布、〇〇銀行）"
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

        <List.Subheader style={styles.subheader}>種類</List.Subheader>
        <Controller
          control={control}
          name="kind"
          render={({ field: { onChange, value } }) => (
            <RadioButton.Group onValueChange={onChange} value={value}>
              {ACCOUNT_KINDS.map((k) => (
                <RadioButton.Item key={k} label={ACCOUNT_KIND_INFO[k].label} value={k} disabled={!isNew} />
              ))}
            </RadioButton.Group>
          )}
        />

        <Controller
          control={control}
          name="openingBalance"
          render={({ field: { onChange, onBlur, value } }) => (
            <TextInput
              mode="outlined"
              label={`${ACCOUNT_KIND_INFO[kind].openingBalanceLabel}（円）`}
              keyboardType="number-pad"
              placeholder="0"
              value={value}
              onChangeText={onChange}
              onBlur={onBlur}
              error={!!errors.openingBalance}
              right={<TextInput.Affix text="円" />}
            />
          )}
        />
        <HelperText type="error" visible={!!errors.openingBalance}>
          {errors.openingBalance?.message}
        </HelperText>

        {canPay(kind) && (
          <Controller
            control={control}
            name="defaultCategoryId"
            render={({ field: { onChange, value } }) => (
              <CategoryPicker
                label="既定のカテゴリ（任意）"
                kind="expense"
                categories={categories.data!}
                value={value}
                onChange={onChange}
              />
            )}
          />
        )}

        {ASSET_KINDS.includes(kind) && (
          <Controller
            control={control}
            name="isReserved"
            render={({ field: { onChange, value } }) => (
              <List.Item
                title="普段使わない口座"
                right={() => <Switch value={value} onValueChange={onChange} />}
                onPress={() => onChange(!value)}
              />
            )}
          />
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

        {!isNew && account.data?.kind === 'credit_card' && (
          <Button
            mode="outlined"
            style={styles.button}
            icon="calendar-clock"
            onPress={() => router.push({ pathname: '/card-settings/[id]', params: { id } })}
            disabled={saving}
          >
            締め日・引き落とし日
          </Button>
        )}
        {!isNew && account.data && (
          <Button
            mode="outlined"
            style={styles.button}
            icon={account.data.is_archived ? 'eye' : 'eye-off'}
            onPress={() => setArchived(!account.data.is_archived)}
            disabled={saving}
          >
            {account.data.is_archived ? '表示に戻す' : '非表示にする'}
          </Button>
        )}
      </KeyboardAwareScrollView>

      <Snackbar
        visible={create.isError || update.isError || createTransaction.isError}
        onDismiss={() => (create.reset(), update.reset(), createTransaction.reset())}
      >
        保存できませんでした。通信状態を確認してください
      </Snackbar>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 16, paddingBottom: 48 },
  subheader: { paddingHorizontal: 0 },
  button: { marginTop: 12 },
});
