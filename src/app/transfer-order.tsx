import { Stack } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { IconButton, Snackbar, Text, useTheme } from 'react-native-paper';
import ReorderableList, { reorderItems, useReorderableDrag } from 'react-native-reorderable-list';

import { DragHandle } from '@/components/DragHandle';
import { ListRow } from '@/components/ListRow';
import { QueryState } from '@/components/QueryState';
import { SectionCard } from '@/components/SectionCard';
import { ACCOUNT_KIND_INFO, ASSET_KINDS } from '@/features/accounts/accountKinds';
import type { Account } from '@/features/accounts/api';
import { useAccounts, useSaveTransferOrder } from '@/features/accounts/hooks';
import { RADIUS, SPACING } from '@/theme';

/** 「振替に使う」の行。つまみを押したまま、または長押しで並べ替え。右のボタンで「使わない」へ */
function UsedRow({ account, index, onExclude }: { account: Account; index: number; onExclude: () => void }) {
  const theme = useTheme();
  const drag = useReorderableDrag();
  return (
    <View style={[styles.tile, { backgroundColor: theme.colors.surface }]}>
      <ListRow
        title={account.name}
        subtitle={`${index + 1}番目`}
        icon={ACCOUNT_KIND_INFO[account.kind].icon}
        onLongPress={drag}
        right={
          <View style={styles.actions}>
            <IconButton
              icon="arrow-down-circle-outline"
              size={20}
              accessibilityLabel={`${account.name}を振替に使わない`}
              onPress={onExclude}
            />
            <DragHandle label={account.name} />
          </View>
        }
      />
    </View>
  );
}

/**
 * 足りなくなる口座への振替の提案で使う口座と、その順番。
 * 「振替に使う」は上から順に使い、ドラッグで並べ替える。「使わない」の口座からは振り替えない
 */
export default function TransferOrderScreen() {
  const theme = useTheme();
  const { data, isLoading, error, refetch } = useAccounts();
  const save = useSaveTransferOrder();
  // 並べ替え・移動の直後は、保存を待たずにその並びで見せる
  const [pending, setPending] = useState<{ used: Account[]; unused: Account[] } | null>(null);

  if (!data) {
    return (
      <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <Stack.Screen options={{ title: '振替の優先度' }} />
        <QueryState isLoading={isLoading} error={error} onRetry={refetch} />
      </View>
    );
  }

  // 振替元になれるのは、非表示でない資産の口座
  const candidates = data.filter((a) => ASSET_KINDS.includes(a.kind) && !a.is_archived);
  const used =
    pending?.used ??
    candidates.filter((a) => a.transfer_priority > 0).sort((a, b) => a.transfer_priority - b.transfer_priority);
  const unused = pending?.unused ?? candidates.filter((a) => a.transfer_priority === 0);

  const commit = (nextUsed: Account[], nextUnused: Account[]) => {
    setPending({ used: nextUsed, unused: nextUnused });
    save.mutate(
      { used: nextUsed.map((a) => a.id), unused: nextUnused.map((a) => a.id) },
      { onSettled: () => setPending(null) },
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <Stack.Screen options={{ title: '振替の優先度' }} />
      <ReorderableList
        data={used}
        keyExtractor={(a) => a.id}
        renderItem={({ item, index }) => (
          <UsedRow
            account={item}
            index={index}
            onExclude={() =>
              commit(
                used.filter((a) => a.id !== item.id),
                [...unused, item],
              )
            }
          />
        )}
        onReorder={({ from, to }) => commit(reorderItems(used, from, to), unused)}
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          <Text variant="titleMedium" style={styles.groupTitle}>
            振替に使う
          </Text>
        }
        ListEmptyComponent={
          <Text variant="bodyMedium" style={[styles.empty, { color: theme.colors.onSurfaceVariant }]}>
            振替に使う口座はありません
          </Text>
        }
        ListFooterComponent={
          unused.length > 0 ? (
            <SectionCard title="使わない" style={styles.unused}>
              {unused.map((a) => (
                <ListRow
                  key={a.id}
                  title={a.name}
                  icon={ACCOUNT_KIND_INFO[a.kind].icon}
                  iconColor={theme.colors.onSurfaceVariant}
                  right={
                    <IconButton
                      icon="arrow-up-circle-outline"
                      size={20}
                      accessibilityLabel={`${a.name}を振替に使う`}
                      onPress={() =>
                        commit(
                          [...used, a],
                          unused.filter((u) => u.id !== a.id),
                        )
                      }
                    />
                  }
                />
              ))}
            </SectionCard>
          ) : null
        }
      />
      <Snackbar visible={save.isError} onDismiss={save.reset}>
        保存できませんでした
      </Snackbar>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  list: { padding: SPACING.screen, paddingTop: 4, paddingBottom: 48 },
  groupTitle: { fontWeight: '700', paddingHorizontal: 4, paddingBottom: 8 },
  tile: { borderRadius: RADIUS.tile, overflow: 'hidden', marginBottom: 8 },
  actions: { flexDirection: 'row', alignItems: 'center' },
  empty: { padding: 16, textAlign: 'center' },
  unused: { marginTop: 8 },
});
