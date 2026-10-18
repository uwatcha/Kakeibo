import { router, Stack } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { IconButton, SegmentedButtons, Snackbar, Text, useTheme } from 'react-native-paper';
import ReorderableList, { reorderItems, useReorderableDrag } from 'react-native-reorderable-list';

import { AddFab } from '@/components/AddFab';
import { DragHandle } from '@/components/DragHandle';
import { ListRow } from '@/components/ListRow';
import { QueryState } from '@/components/QueryState';
import { SectionCard } from '@/components/SectionCard';
import type { Category } from '@/features/categories/api';
import { useCategories, useReorderCategories } from '@/features/categories/hooks';
import { categoryIcon } from '@/features/categories/icons';
import type { CategoryKind } from '@/features/transactions/transactionRules';
import { RADIUS, SPACING } from '@/theme';

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
    <View style={[styles.tile, { backgroundColor: theme.colors.surface }]}>
      <ListRow
        title={parent.name}
        icon={categoryIcon(parent.id, [parent], 'shape')}
        onPress={() => openCategory({ id: parent.id })}
        onLongPress={drag}
        right={
          <View style={styles.row}>
            <IconButton
              icon="plus"
              size={20}
              accessibilityLabel={`${parent.name}に小分類を追加`}
              onPress={() => openCategory({ id: 'new', kind, parentId: parent.id })}
            />
            <DragHandle label={parent.name} />
          </View>
        }
      />
      {subcategories.map((child) => (
        <ListRow
          key={child.id}
          title={child.name}
          icon="subdirectory-arrow-right"
          iconColor={theme.colors.onSurfaceVariant}
          style={styles.child}
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
              <SectionCard title="非表示にしたカテゴリ" style={styles.archived}>
                {archived.map((c) => {
                  const parent = parents.find((p) => p.id === c.parent_id);
                  return (
                    <ListRow
                      key={c.id}
                      title={parent ? `${parent.name} / ${c.name}` : c.name}
                      onPress={() => openCategory({ id: c.id })}
                    />
                  );
                })}
              </SectionCard>
            ) : null
          }
        />
      )}
      <AddFab label="大分類を追加" onPress={() => openCategory({ id: 'new', kind })} />
      <Snackbar visible={reorder.isError} onDismiss={reorder.reset}>
        並べ替えを保存できませんでした
      </Snackbar>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  segment: { marginHorizontal: SPACING.screen, marginTop: 4, marginBottom: 12 },
  list: { paddingHorizontal: SPACING.screen, paddingBottom: 96 },
  tile: { borderRadius: RADIUS.tile, overflow: 'hidden', marginBottom: 8 },
  row: { flexDirection: 'row', alignItems: 'center' },
  child: { paddingLeft: 16 },
  archived: { marginTop: 8 },
  empty: { padding: 24, textAlign: 'center' },
});
