import { router, Stack } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Button, Dialog, IconButton, Portal, Snackbar, Text, useTheme } from 'react-native-paper';

import { Amount } from '@/components/Amount';
import { ListRow } from '@/components/ListRow';
import { QueryState } from '@/components/QueryState';
import { SectionCard } from '@/components/SectionCard';
import { useAccounts } from '@/features/accounts/hooks';
import type { Transaction } from '@/features/transactions/api';
import { useConfirmTransactions, useUnconfirmed } from '@/features/transactions/hooks';
import { TRANSACTION_RULES } from '@/features/transactions/transactionRules';
import { formatDay, toTokyoDateString } from '@/lib/date';
import { SPACING } from '@/theme';

/**
 * 日付が過ぎたのに未確認の記録（予定として入れたもの・定期支払い・給料の予定など）をまとめて確認する。
 * 確認するまで残高・集計に入らない。実際と違えば、行を押して記録を直してから確認する
 */
export default function UnconfirmedScreen() {
  const theme = useTheme();
  const today = toTokyoDateString();
  const unconfirmed = useUnconfirmed(today);
  const accounts = useAccounts();
  const confirm = useConfirmTransactions();
  const [confirmAll, setConfirmAll] = useState(false);

  if (!unconfirmed.data || !accounts.data) {
    return (
      <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <Stack.Screen options={{ title: '未確認の記録' }} />
        <QueryState
          isLoading={!(unconfirmed.error ?? accounts.error)}
          error={unconfirmed.error ?? accounts.error}
          onRetry={() => {
            unconfirmed.refetch();
            accounts.refetch();
          }}
        />
      </View>
    );
  }

  const name = (id: string | null) => accounts.data.find((a) => a.id === id)?.name ?? '';
  const where = (t: Transaction) => [name(t.from_account_id), name(t.to_account_id)].filter(Boolean).join(' → ');
  const items = unconfirmed.data;

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <Stack.Screen options={{ title: '未確認の記録' }} />
      <ScrollView contentContainerStyle={styles.content}>
        {items.length === 0 ? (
          <Text variant="bodyMedium" style={[styles.empty, { color: theme.colors.onSurfaceVariant }]}>
            未確認の記録はありません
          </Text>
        ) : (
          <>
            <SectionCard title={`${items.length}件`}>
              {items.map((t) => {
                const kind = t.type === 'income' ? 'income' : t.type === 'expense' ? 'expense' : 'neutral';
                return (
                  <ListRow
                    key={t.id}
                    title={t.payee || TRANSACTION_RULES[t.type].label}
                    subtitle={`${formatDay(t.date)}・${where(t)}`}
                    icon={TRANSACTION_RULES[t.type].icon}
                    onPress={() => router.push({ pathname: '/transaction/[id]', params: { id: t.id } })}
                    right={
                      <View style={styles.right}>
                        <Amount value={t.amount} kind={kind} variant="bodyLarge" />
                        <IconButton
                          icon="check-circle-outline"
                          iconColor={theme.colors.primary}
                          accessibilityLabel="確認した"
                          disabled={confirm.isPending}
                          onPress={() => confirm.mutate([t.id])}
                          style={styles.check}
                        />
                      </View>
                    }
                  />
                );
              })}
            </SectionCard>
            <Button mode="contained" icon="check-all" onPress={() => setConfirmAll(true)} disabled={confirm.isPending}>
              すべて確認した
            </Button>
          </>
        )}
      </ScrollView>

      <Portal>
        <Dialog visible={confirmAll} onDismiss={() => setConfirmAll(false)}>
          <Dialog.Title>すべて確認した</Dialog.Title>
          <Dialog.Content>
            <Text variant="bodyMedium">{items.length}件をそのままの金額で確認済みにし、残高と集計に入れます。</Text>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setConfirmAll(false)}>キャンセル</Button>
            <Button
              onPress={() => {
                confirm.mutate(items.map((t) => t.id));
                setConfirmAll(false);
              }}
            >
              確認した
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
      <Snackbar visible={confirm.isError} onDismiss={confirm.reset}>
        保存できませんでした
      </Snackbar>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: SPACING.screen, paddingTop: 4, gap: SPACING.gap, paddingBottom: 48 },
  empty: { padding: 24, textAlign: 'center' },
  right: { flexDirection: 'row', alignItems: 'center' },
  check: { margin: -4, marginLeft: 4 },
});
