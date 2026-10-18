import { router, Stack } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { FAB, IconButton, List, SegmentedButtons, Snackbar, Text, useTheme } from 'react-native-paper';

import { QueryState } from '@/components/QueryState';
import type { Category } from '@/features/categories/api';
import { useCategories, useReorderCategories } from '@/features/categories/hooks';
import type { CategoryKind } from '@/features/transactions/transactionRules';

function openCategory(params: { id: string; kind?: CategoryKind; parentId?: string }) {
  router.push({ pathname: '/categories/[id]', params });
}

export default function CategoriesScreen() {
  const theme = useTheme();
  const [kind, setKind] = useState<CategoryKind>('expense');
  const { data, isLoading, error, refetch } = useCategories();
  const reorder = useReorderCategories();

  const ofKind = (data ?? []).filter((c) => c.kind === kind);
  const parents = ofKind.filter((c) => c.parent_id === null);
  const activeParents = parents.filter((c) => !c.is_archived);
  const archived = ofKind.filter((c) => c.is_archived);
  const childrenOf = (parentId: string) => ofKind.filter((c) => c.parent_id === parentId && !c.is_archived);

  /** 同じ階層（兄弟）の中で1つ動かす */
  const move = (siblings: Category[], index: number, delta: -1 | 1) => {
    const ids = siblings.map((c) => c.id);
    const target = index + delta;
    [ids[index], ids[target]] = [ids[target], ids[index]];
    reorder.mutate(ids);
  };

  const moveButtons = (siblings: Category[], index: number) => (
    <View style={styles.row}>
      <IconButton
        icon="chevron-up"
        size={20}
        accessibilityLabel="上へ"
        disabled={index === 0 || reorder.isPending}
        onPress={() => move(siblings, index, -1)}
      />
      <IconButton
        icon="chevron-down"
        size={20}
        accessibilityLabel="下へ"
        disabled={index === siblings.length - 1 || reorder.isPending}
        onPress={() => move(siblings, index, 1)}
      />
    </View>
  );

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <Stack.Screen options={{ title: 'カテゴリの管理' }} />
      <SegmentedButtons
        style={styles.segment}
        value={kind}
        onValueChange={(v) => setKind(v as CategoryKind)}
        buttons={[
          { value: 'expense', label: '支出' },
          { value: 'income', label: '収入' },
        ]}
      />
      {!data ? (
        <QueryState isLoading={isLoading} error={error} onRetry={refetch} />
      ) : (
        <ScrollView contentContainerStyle={styles.list}>
          {activeParents.map((parent, index) => {
            const children = childrenOf(parent.id);
            return (
              <View key={parent.id}>
                <List.Item
                  title={parent.name}
                  titleStyle={styles.parentTitle}
                  onPress={() => openCategory({ id: parent.id })}
                  right={() => (
                    <View style={styles.row}>
                      <IconButton
                        icon="plus"
                        size={20}
                        accessibilityLabel={`${parent.name}に小分類を追加`}
                        onPress={() => openCategory({ id: 'new', kind, parentId: parent.id })}
                      />
                      {moveButtons(activeParents, index)}
                    </View>
                  )}
                />
                {children.map((child, childIndex) => (
                  <List.Item
                    key={child.id}
                    title={child.name}
                    style={styles.child}
                    left={(props) => <List.Icon {...props} icon="subdirectory-arrow-right" />}
                    onPress={() => openCategory({ id: child.id })}
                    right={() => moveButtons(children, childIndex)}
                  />
                ))}
              </View>
            );
          })}
          {activeParents.length === 0 && (
            <Text style={styles.empty} variant="bodyMedium">
              右下の「＋」から追加してください
            </Text>
          )}
          {archived.length > 0 && (
            <List.Section title="非表示にしたカテゴリ">
              {archived.map((c) => {
                const parent = parents.find((p) => p.id === c.parent_id);
                return (
                  <List.Item
                    key={c.id}
                    title={parent ? `${parent.name} / ${c.name}` : c.name}
                    onPress={() => openCategory({ id: c.id })}
                  />
                );
              })}
            </List.Section>
          )}
        </ScrollView>
      )}
      <FAB icon="plus" label="大分類を追加" style={styles.fab} onPress={() => openCategory({ id: 'new', kind })} />
      <Snackbar visible={reorder.isError} onDismiss={reorder.reset}>
        並べ替えを保存できませんでした
      </Snackbar>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  segment: { margin: 16, marginBottom: 8 },
  list: { paddingBottom: 96 },
  row: { flexDirection: 'row', alignItems: 'center' },
  parentTitle: { fontWeight: 'bold' },
  child: { paddingLeft: 16 },
  empty: { padding: 24, textAlign: 'center' },
  fab: { position: 'absolute', right: 16, bottom: 16 },
});
