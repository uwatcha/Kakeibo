import { zodResolver } from '@hookform/resolvers/zod';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { StyleSheet, View } from 'react-native';
import { Button, HelperText, List, Snackbar, Text, TextInput, useTheme } from 'react-native-paper';
import ReorderableList, { reorderItems } from 'react-native-reorderable-list';
import { z } from 'zod';

import { DragHandle } from '@/components/DragHandle';
import { QueryState } from '@/components/QueryState';
import type { Category } from '@/features/categories/api';
import { useCategories, useCreateCategory, useReorderCategories, useUpdateCategory } from '@/features/categories/hooks';
import type { CategoryKind } from '@/features/transactions/transactionRules';

const schema = z.object({
  name: z.string().trim().min(1, '名前を入力してください').max(30, '30文字以内にしてください'),
});

type FormValues = z.infer<typeof schema>;

export default function CategoryEditScreen() {
  const theme = useTheme();
  // 新規は id = 'new' と kind（＋小分類なら parentId）を受け取る
  const params = useLocalSearchParams<{ id: string; kind?: CategoryKind; parentId?: string }>();
  const isNew = params.id === 'new';

  const categories = useCategories();
  const create = useCreateCategory();
  const update = useUpdateCategory();
  const reorder = useReorderCategories();
  // 小分類をドロップした直後は保存を待たずに並べ替え後の順で見せる
  const [pendingOrder, setPendingOrder] = useState<Category[] | null>(null);

  const category = categories.data?.find((c) => c.id === params.id);
  const parentId = isNew ? (params.parentId ?? null) : (category?.parent_id ?? null);
  const parent = categories.data?.find((c) => c.id === parentId);
  const kind: CategoryKind = isNew ? (params.kind ?? 'expense') : (category?.kind ?? 'expense');

  const {
    control,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: { name: '' } });

  useEffect(() => {
    if (category) reset({ name: category.name });
  }, [category, reset]);

  const siblings = (categories.data ?? []).filter((c) => c.kind === kind && c.parent_id === parentId);

  const onSubmit = async ({ name }: FormValues) => {
    try {
      if (isNew) {
        const maxOrder = Math.max(0, ...siblings.map((c) => c.sort_order));
        await create.mutateAsync({ name, kind, parent_id: parentId, sort_order: maxOrder + 10 });
      } else {
        await update.mutateAsync({ id: params.id, values: { name } });
      }
      router.back();
    } catch {
      // Snackbar で知らせる
    }
  };

  const setArchived = async (isArchived: boolean) => {
    try {
      await update.mutateAsync({ id: params.id, values: { is_archived: isArchived } });
      router.back();
    } catch {
      // 同上
    }
  };

  const title = isNew ? (parentId ? '小分類を追加' : '大分類を追加') : 'カテゴリを編集';
  if (!categories.data || (!isNew && !category)) {
    return (
      <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <Stack.Screen options={{ title }} />
        <QueryState isLoading={categories.isLoading} error={categories.error} onRetry={categories.refetch} />
      </View>
    );
  }

  const saving = isSubmitting || update.isPending;
  const subcategories =
    pendingOrder ?? (category ? categories.data.filter((c) => c.parent_id === category.id && !c.is_archived) : []);

  const onReorderSubcategories = ({ from, to }: { from: number; to: number }) => {
    const next = reorderItems(subcategories, from, to);
    setPendingOrder(next);
    reorder.mutate(
      next.map((c) => c.id),
      { onSettled: () => setPendingOrder(null) },
    );
  };

  return (
    <View style={[styles.container, styles.content, { backgroundColor: theme.colors.background }]}>
      <Stack.Screen options={{ title }} />
      <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant }}>
        {kind === 'expense' ? '支出' : '収入'}
        {parent ? ` / ${parent.name} の小分類` : ' の大分類'}
      </Text>

      <Controller
        control={control}
        name="name"
        render={({ field: { onChange, onBlur, value } }) => (
          <TextInput
            mode="outlined"
            label="名前"
            autoFocus={isNew}
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

      <Button mode="contained" onPress={() => handleSubmit(onSubmit)()} loading={saving} disabled={saving}>
        保存
      </Button>

      {category && (
        <>
          <Button
            mode="outlined"
            style={styles.button}
            icon={category.is_archived ? 'eye' : 'eye-off'}
            onPress={() => setArchived(!category.is_archived)}
            disabled={saving}
          >
            {category.is_archived ? '表示に戻す' : '非表示にする'}
          </Button>
        </>
      )}

      {category && !category.parent_id && subcategories.length > 0 && (
        <>
          <List.Subheader style={styles.subheader}>小分類</List.Subheader>
          <ReorderableList
            data={subcategories}
            keyExtractor={(c) => c.id}
            renderItem={({ item }) => (
              <List.Item
                title={item.name}
                style={{ backgroundColor: theme.colors.background }}
                right={() => <DragHandle label={item.name} />}
                onPress={() => router.push({ pathname: '/categories/[id]', params: { id: item.id } })}
              />
            )}
            onReorder={onReorderSubcategories}
            style={styles.subList}
          />
        </>
      )}

      <Snackbar
        visible={create.isError || update.isError || reorder.isError}
        onDismiss={() => (create.reset(), update.reset(), reorder.reset())}
      >
        保存できませんでした。通信状態を確認してください
      </Snackbar>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 16, gap: 4 },
  button: { marginTop: 12 },
  subheader: { paddingHorizontal: 0, marginTop: 16 },
  subList: { flex: 1 },
});
