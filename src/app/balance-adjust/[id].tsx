import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import { Button, HelperText, Snackbar, Text, TextInput, useTheme } from 'react-native-paper';

import { QueryState } from '@/components/QueryState';
import { ACCOUNT_KIND_INFO, isLiability } from '@/features/accounts/accountKinds';
import { planAdjustment } from '@/features/accounts/adjustment';
import { useAccount, useBalanceAsOf } from '@/features/accounts/hooks';
import { useCreateTransaction } from '@/features/transactions/hooks';
import { toTokyoDateString } from '@/lib/date';
import { formatYen, parseNonNegativeYen } from '@/lib/money';

export default function BalanceAdjustScreen() {
  const theme = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const today = toTokyoDateString();
  const account = useAccount(id);
  const balance = useBalanceAsOf(id, today);
  const create = useCreateTransaction();
  const [input, setInput] = useState('');

  if (!account.data || balance.data === undefined) {
    return (
      <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <Stack.Screen options={{ title: '残高を合わせる' }} />
        <QueryState
          isLoading={!(account.error ?? balance.error)}
          error={account.error ?? balance.error}
          onRetry={() => {
            account.refetch();
            balance.refetch();
          }}
        />
      </View>
    );
  }

  const kind = account.data.kind;
  const label = isLiability(kind) ? ACCOUNT_KIND_INFO[kind].openingBalanceLabel.replace('今の', '') : '残高';
  // 負債は「未払い額・借りている額」として正の値で見せる
  const appShown = isLiability(kind) ? 0 - balance.data : balance.data;
  const actual = input.trim() === '' ? null : parseNonNegativeYen(input);
  const plan = actual === null ? null : planAdjustment(kind, balance.data, actual);
  // 画面に出す差額（実際 − アプリ。負債も「未払い額」どうしの差で見せる）
  const shownDiff = actual === null ? 0 : actual - appShown;

  const onSave = async () => {
    if (!plan) return;
    try {
      await create.mutateAsync({
        type: 'adjustment',
        amount: plan.amount,
        from_account_id: plan.direction === 'decrease' ? id : null,
        to_account_id: plan.direction === 'increase' ? id : null,
        date: today,
        payee: '残高を合わせる',
      });
      router.back();
    } catch {
      // Snackbar で知らせる
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <Stack.Screen options={{ title: `${account.data.name}の残高を合わせる` }} />
      <KeyboardAwareScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        bottomOffset={24}
      >
        <View style={styles.row}>
          <Text variant="bodyLarge">アプリの{label}</Text>
          <Text variant="titleMedium" style={styles.number}>
            {formatYen(appShown)}
          </Text>
        </View>

        <TextInput
          mode="outlined"
          label={`実際の${label}`}
          keyboardType="number-pad"
          autoFocus
          value={input}
          onChangeText={setInput}
          error={input.trim() !== '' && actual === null}
          right={<TextInput.Affix text="円" />}
        />
        <HelperText type="error" visible={input.trim() !== '' && actual === null}>
          0以上の整数（円）で入力してください
        </HelperText>

        {actual !== null && (
          <View style={styles.row}>
            <Text variant="bodyLarge">差額</Text>
            <Text variant="titleMedium" style={styles.number}>
              {plan ? `${shownDiff > 0 ? '+' : ''}${formatYen(shownDiff)}` : 'ずれはありません'}
            </Text>
          </View>
        )}

        <Button
          mode="contained"
          style={styles.button}
          onPress={onSave}
          loading={create.isPending}
          disabled={!plan || create.isPending}
        >
          合わせる
        </Button>
      </KeyboardAwareScrollView>

      <Snackbar visible={create.isError} onDismiss={create.reset}>
        保存できませんでした。通信状態を確認してください
      </Snackbar>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 16, gap: 8 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8 },
  number: { fontVariant: ['tabular-nums'] },
  button: { marginTop: 8 },
});
