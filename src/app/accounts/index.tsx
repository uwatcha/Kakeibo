import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { router, Stack } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { FAB, List, Snackbar, Text, useTheme } from 'react-native-paper';
import ReorderableList, { reorderItems, useReorderableDrag } from 'react-native-reorderable-list';

import { QueryState } from '@/components/QueryState';
import { ACCOUNT_KIND_INFO } from '@/features/accounts/accountKinds';
import type { Account } from '@/features/accounts/api';
import { useAccounts, useReorderAccounts } from '@/features/accounts/hooks';

function openAccount(id: string) {
  router.push({ pathname: '/accounts/[id]', params: { id } });
}

function describe(account: Account) {
  return ACCOUNT_KIND_INFO[account.kind].label + (account.is_reserved ? '・普段使わない' : '');
}

/** 並べ替えできる行。右のつまみを押したまま動かすか、行を長押しして動かす */
function DraggableRow({ account }: { account: Account }) {
  const theme = useTheme();
  const drag = useReorderableDrag();
  return (
    <List.Item
      title={account.name}
      description={describe(account)}
      style={{ backgroundColor: theme.colors.background }}
      left={(props) => <List.Icon {...props} icon={ACCOUNT_KIND_INFO[account.kind].icon} />}
      right={() => (
        <Pressable onPressIn={drag} hitSlop={12} accessibilityLabel={`${account.name}を並べ替え`} style={styles.handle}>
          <MaterialCommunityIcons name="drag-horizontal-variant" size={24} color={theme.colors.onSurfaceVariant} />
        </Pressable>
      )}
      onPress={() => openAccount(account.id)}
      onLongPress={drag}
    />
  );
}

export default function AccountsScreen() {
  const theme = useTheme();
  const { data, isLoading, error, refetch } = useAccounts();
  const reorder = useReorderAccounts();
  // ドロップした直後は保存を待たずに並べ替え後の順で見せる
  const [pendingOrder, setPendingOrder] = useState<Account[] | null>(null);

  const active = pendingOrder ?? data?.filter((a) => !a.is_archived) ?? [];
  const archived = data?.filter((a) => a.is_archived) ?? [];

  const onReorder = ({ from, to }: { from: number; to: number }) => {
    const next = reorderItems(active, from, to);
    setPendingOrder(next);
    reorder.mutate(
      next.map((a) => a.id),
      { onSettled: () => setPendingOrder(null) },
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <Stack.Screen options={{ title: '口座の管理' }} />
      {!data ? (
        <QueryState isLoading={isLoading} error={error} onRetry={refetch} />
      ) : (
        <ReorderableList
          data={active}
          keyExtractor={(a) => a.id}
          renderItem={({ item }) => <DraggableRow account={item} />}
          onReorder={onReorder}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <Text style={styles.empty} variant="bodyMedium">
              口座がありません
            </Text>
          }
          ListFooterComponent={
            archived.length > 0 ? (
              <List.Section title="非表示にした口座">
                {archived.map((a) => (
                  <List.Item
                    key={a.id}
                    title={a.name}
                    description={describe(a)}
                    left={(props) => <List.Icon {...props} icon={ACCOUNT_KIND_INFO[a.kind].icon} />}
                    onPress={() => openAccount(a.id)}
                  />
                ))}
              </List.Section>
            ) : null
          }
        />
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
  handle: { justifyContent: 'center', paddingHorizontal: 8 },
  fab: { position: 'absolute', right: 16, bottom: 16 },
});
