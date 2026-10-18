import { router, Stack } from 'expo-router';
import { ScrollView, StyleSheet, View } from 'react-native';
import { FAB, IconButton, List, Snackbar, Text, useTheme } from 'react-native-paper';

import { QueryState } from '@/components/QueryState';
import { ACCOUNT_KIND_INFO } from '@/features/accounts/accountKinds';
import type { Account } from '@/features/accounts/api';
import { useAccounts, useReorderAccounts } from '@/features/accounts/hooks';

function openAccount(id: string) {
  router.push({ pathname: '/accounts/[id]', params: { id } });
}

export default function AccountsScreen() {
  const theme = useTheme();
  const { data, isLoading, error, refetch } = useAccounts();
  const reorder = useReorderAccounts();

  const active = data?.filter((a) => !a.is_archived) ?? [];
  const archived = data?.filter((a) => a.is_archived) ?? [];

  const move = (index: number, delta: -1 | 1) => {
    const ids = active.map((a) => a.id);
    const target = index + delta;
    [ids[index], ids[target]] = [ids[target], ids[index]];
    reorder.mutate(ids);
  };

  const renderItem = (account: Account, index?: number) => (
    <List.Item
      key={account.id}
      title={account.name}
      description={ACCOUNT_KIND_INFO[account.kind].label + (account.is_reserved ? '・普段使わない' : '')}
      left={(props) => <List.Icon {...props} icon={ACCOUNT_KIND_INFO[account.kind].icon} />}
      right={() =>
        index === undefined ? null : (
          <View style={styles.moveButtons}>
            <IconButton
              icon="chevron-up"
              accessibilityLabel="上へ"
              disabled={index === 0 || reorder.isPending}
              onPress={() => move(index, -1)}
            />
            <IconButton
              icon="chevron-down"
              accessibilityLabel="下へ"
              disabled={index === active.length - 1 || reorder.isPending}
              onPress={() => move(index, 1)}
            />
          </View>
        )
      }
      onPress={() => openAccount(account.id)}
    />
  );

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <Stack.Screen options={{ title: '口座の管理' }} />
      {!data ? (
        <QueryState isLoading={isLoading} error={error} onRetry={refetch} />
      ) : (
        <ScrollView contentContainerStyle={styles.list}>
          {active.length === 0 && (
            <Text style={styles.empty} variant="bodyMedium">
              口座がありません
            </Text>
          )}
          {active.map((a, i) => renderItem(a, i))}
          {archived.length > 0 && (
            <List.Section title="非表示にした口座">{archived.map((a) => renderItem(a))}</List.Section>
          )}
        </ScrollView>
      )}
      <FAB icon="plus" label="口座を追加" style={styles.fab} onPress={() => openAccount('new')} />
      <Snackbar visible={reorder.isError} onDismiss={reorder.reset}>
        並べ替えを保存できませんでした
      </Snackbar>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  list: { paddingBottom: 96 },
  empty: { padding: 24, textAlign: 'center' },
  moveButtons: { flexDirection: 'row', alignItems: 'center' },
  fab: { position: 'absolute', right: 16, bottom: 16 },
});
