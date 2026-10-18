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
import { useAccount, useAccounts, useCreateAccount, useUpdateAccount } from '@/features/accounts/hooks';
import { parseNonNegativeYen } from '@/lib/money';

const schema = z.object({
  name: z.string().trim().min(1, '名前を入力してください').max(50, '50文字以内にしてください'),
  kind: z.enum(ACCOUNT_KINDS as [string, ...string[]]),
  openingBalance: z.string().refine((v) => parseNonNegativeYen(v) !== null, '0以上の整数（円）で入力してください'),
  isReserved: z.boolean(),
});

type FormValues = z.infer<typeof schema>;
type Kind = (typeof ACCOUNT_KINDS)[number];

export default function AccountEditScreen() {
  const theme = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const isNew = id === 'new';

  const account = useAccount(isNew ? undefined : id);
  const accounts = useAccounts();
  const create = useCreateAccount();
  const update = useUpdateAccount();

  const {
    control,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { name: '', kind: 'cash', openingBalance: '', isReserved: false },
  });
  const kind = useWatch({ control, name: 'kind' }) as Kind;

  useEffect(() => {
    if (account.data) {
      reset({
        name: account.data.name,
        kind: account.data.kind,
        openingBalance: String(fromOpeningBalance(account.data.kind, account.data.opening_balance)),
        isReserved: account.data.is_reserved,
      });
    }
  }, [account.data, reset]);

  const onSubmit = async (values: FormValues) => {
    const valuesKind = values.kind as Kind;
    const common = {
      name: values.name,
      opening_balance: toOpeningBalance(valuesKind, parseNonNegativeYen(values.openingBalance) ?? 0),
      // 普段使わない口座の区別は資産の口座だけ
      is_reserved: ASSET_KINDS.includes(valuesKind) && values.isReserved,
    };
    try {
      if (isNew) {
        const maxOrder = Math.max(0, ...(accounts.data ?? []).map((a) => a.sort_order));
        await create.mutateAsync({
          ...common,
          kind: valuesKind,
          sort_order: maxOrder + 10,
          // 作るときだけ、普段使わない口座は汎用資産に含めない状態から始める（あとはホームの ⚙ で切り替える）
          include_in_available: !common.is_reserved,
        });
      } else {
        await update.mutateAsync({ id, values: common });
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

  if (!isNew && !account.data) {
    return (
      <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <Stack.Screen options={{ title }} />
        <QueryState isLoading={account.isLoading} error={account.error} onRetry={account.refetch} />
      </View>
    );
  }

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
        {!isNew && account.data && !account.data.is_archived && (
          <Button
            mode="outlined"
            style={styles.button}
            icon="scale-balance"
            onPress={() => router.push({ pathname: '/balance-adjust/[id]', params: { id } })}
            disabled={saving}
          >
            残高を合わせる
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

      <Snackbar visible={create.isError || update.isError} onDismiss={() => (create.reset(), update.reset())}>
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
