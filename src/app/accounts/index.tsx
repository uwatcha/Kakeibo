import { router, Stack } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Snackbar, Text, useTheme } from 'react-native-paper';
import ReorderableList, { reorderItems, useReorderableDrag } from 'react-native-reorderable-list';

import { AddFab } from '@/components/AddFab';
import { DragHandle } from '@/components/DragHandle';
import { ListRow } from '@/components/ListRow';
import { QueryState } from '@/components/QueryState';
import { SectionCard } from '@/components/SectionCard';
import { ACCOUNT_KIND_INFO } from '@/features/accounts/accountKinds';
import type { Account } from '@/features/accounts/api';
import { useAccounts, useReorderAccounts } from '@/features/accounts/hooks';
import { RADIUS, SPACING } from '@/theme';

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
    <View style={[styles.tile, { backgroundColor: theme.colors.surface }]}>
      <ListRow
        title={account.name}
        subtitle={describe(account)}
        icon={ACCOUNT_KIND_INFO[account.kind].icon}
        right={<DragHandle label={account.name} />}
        onPress={() => openAccount(account.id)}
        onLongPress={drag}
      />
    </View>
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
              <SectionCard title="非表示にした口座" style={styles.archived}>
                {archived.map((a) => (
                  <ListRow
                    key={a.id}
                    title={a.name}
                    subtitle={describe(a)}
                    icon={ACCOUNT_KIND_INFO[a.kind].icon}
                    iconColor={theme.colors.onSurfaceVariant}
                    onPress={() => openAccount(a.id)}
                  />
                ))}
              </SectionCard>
            ) : null
          }
        />
      )}
      <AddFab label="口座を追加" onPress={() => openAccount('new')} />
      <Snackbar visible={reorder.isError} onDismiss={reorder.reset}>
        並べ替えを保存できませんでした
      </Snackbar>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  list: { padding: SPACING.screen, paddingTop: 4, paddingBottom: 96 },
  tile: { borderRadius: RADIUS.tile, overflow: 'hidden', marginBottom: 8 },
  archived: { marginTop: 8 },
  empty: { padding: 24, textAlign: 'center' },
});
