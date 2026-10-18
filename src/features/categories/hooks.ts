import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  type CategoryInsert,
  type CategoryUpdate,
  createCategory,
  fetchCategories,
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
