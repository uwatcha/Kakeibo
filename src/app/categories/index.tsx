import { router, Stack } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { FAB, IconButton, List, SegmentedButtons, Snackbar, Text, useTheme } from 'react-native-paper';
import ReorderableList, { reorderItems, useReorderableDrag } from 'react-native-reorderable-list';

import { DragHandle } from '@/components/DragHandle';
import { QueryState } from '@/components/QueryState';
import type { Category } from '@/features/categories/api';
import { useCategories, useReorderCategories } from '@/features/categories/hooks';
import type { CategoryKind } from '@/features/transactions/transactionRules';

function openCategory(params: { id: string; kind?: CategoryKind; parentId?: string }) {
  router.push({ pathname: '/categories/[id]', params });
}

/** 大分類の行。小分類は下に並べ、大分類と一緒に動く（小分類の並べ替えは大分類の編集画面で行う） */
function ParentCell({
  parent,
  subcategories,
  kind,
}: {
  parent: Category;
  subcategories: Category[];
  kind: CategoryKind;
}) {
  const theme = useTheme();
  const drag = useReorderableDrag();
  return (
    <View style={{ backgroundColor: theme.colors.background }}>
      <List.Item
        title={parent.name}
        titleStyle={styles.parentTitle}
        onPress={() => openCategory({ id: parent.id })}
        onLongPress={drag}
        right={() => (
          <View style={styles.row}>
            <IconButton
              icon="plus"
              size={20}
              accessibilityLabel={`${parent.name}に小分類を追加`}
              onPress={() => openCategory({ id: 'new', kind, parentId: parent.id })}
            />
            <DragHandle label={parent.name} />
          </View>
        )}
      />
      {subcategories.map((child) => (
        <List.Item
          key={child.id}
          title={child.name}
          style={styles.child}
          left={(props) => <List.Icon {...props} icon="subdirectory-arrow-right" />}
          onPress={() => openCategory({ id: child.id })}
        />
      ))}
    </View>
  );
}

export default function CategoriesScreen() {
  const theme = useTheme();
  const [kind, setKind] = useState<CategoryKind>('expense');
  const { data, isLoading, error, refetch } = useCategories();
  const reorder = useReorderCategories();
  // ドロップした直後は保存を待たずに並べ替え後の順で見せる
  const [pendingOrder, setPendingOrder] = useState<Category[] | null>(null);

  const ofKind = (data ?? []).filter((c) => c.kind === kind);
  const parents = ofKind.filter((c) => c.parent_id === null);
  const activeParents = pendingOrder ?? parents.filter((c) => !c.is_archived);
  const archived = ofKind.filter((c) => c.is_archived);
  const childrenOf = (parentId: string) => ofKind.filter((c) => c.parent_id === parentId && !c.is_archived);

  const onReorder = ({ from, to }: { from: number; to: number }) => {
    const next = reorderItems(activeParents, from, to);
    setPendingOrder(next);
    reorder.mutate(
      next.map((c) => c.id),
      { onSettled: () => setPendingOrder(null) },
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <Stack.Screen options={{ title: 'カテゴリの管理' }} />
      <SegmentedButtons
        style={styles.segment}
        value={kind}
        onValueChange={(v) => {
          setPendingOrder(null);
          setKind(v as CategoryKind);
        }}
        buttons={[
          { value: 'expense', label: '支出' },
          { value: 'income', label: '収入' },
        ]}
      />
      {!data ? (
        <QueryState isLoading={isLoading} error={error} onRetry={refetch} />
      ) : (
        <ReorderableList
          data={activeParents}
          keyExtractor={(c) => c.id}
          renderItem={({ item }) => <ParentCell parent={item} subcategories={childrenOf(item.id)} kind={kind} />}
          onReorder={onReorder}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <Text style={styles.empty} variant="bodyMedium">
              カテゴリがありません
            </Text>
          }
          ListFooterComponent={
            archived.length > 0 ? (
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
            ) : null
          }
        />
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
