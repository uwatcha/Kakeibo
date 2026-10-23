import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  type CategoryInsert,
  type CategoryUpdate,
  createCategory,
  deleteUnusedCategory,
  fetchCategories,
  fetchCategoryUsage,
  moveCategoryRecords,
  reorderCategories,
  updateCategory,
} from './api';

export const categoryKeys = {
  all: ['categories'] as const,
  list: () => [...categoryKeys.all, 'list'] as const,
};

export function useCategories() {
  return useQuery({ queryKey: categoryKeys.list(), queryFn: fetchCategories });
}

// カテゴリ名は集計にも出るので、集計も再取得する
function useInvalidateCategories() {
  const queryClient = useQueryClient();
  return () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: categoryKeys.all }),
      queryClient.invalidateQueries({ queryKey: ['reports'] }),
    ]);
}

export function useCreateCategory() {
  const invalidate = useInvalidateCategories();
  return useMutation({ mutationFn: (values: CategoryInsert) => createCategory(values), onSuccess: invalidate });
}

export function useUpdateCategory() {
  const invalidate = useInvalidateCategories();
  return useMutation({
    mutationFn: ({ id, values }: { id: string; values: CategoryUpdate }) => updateCategory(id, values),
    onSuccess: invalidate,
  });
}

export function useReorderCategories() {
  const invalidate = useInvalidateCategories();
  return useMutation({ mutationFn: (orderedIds: string[]) => reorderCategories(orderedIds), onSettled: invalidate });
}

/** カテゴリが使われている数（記録を変えたら読み直すので、記録のキーの下に置く） */
export function useCategoryUsage(id: string | undefined) {
  return useQuery({
    queryKey: ['transactions', 'categoryUsage', id],
    queryFn: () => fetchCategoryUsage(id!),
    enabled: !!id,
  });
}

// 記録のカテゴリが変わるので、記録・集計・定期支払いも読み直す
function useInvalidateAfterMove() {
  const queryClient = useQueryClient();
  return () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: categoryKeys.all }),
      queryClient.invalidateQueries({ queryKey: ['transactions'] }),
      queryClient.invalidateQueries({ queryKey: ['reports'] }),
      queryClient.invalidateQueries({ queryKey: ['recurring'] }),
      queryClient.invalidateQueries({ queryKey: ['accounts'] }),
      queryClient.invalidateQueries({ queryKey: ['emailImport'] }),
    ]);
}

export function useMoveCategoryRecords() {
  const invalidate = useInvalidateAfterMove();
  return useMutation({
    mutationFn: ({ source, destination }: { source: string; destination: string }) =>
      moveCategoryRecords(source, destination),
    onSuccess: invalidate,
  });
}

export function useDeleteUnusedCategory() {
  const invalidate = useInvalidateAfterMove();
  return useMutation({ mutationFn: deleteUnusedCategory, onSuccess: invalidate });
}
