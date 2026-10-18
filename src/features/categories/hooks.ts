import { useQuery } from '@tanstack/react-query';

import { fetchCategories } from './api';

export const categoryKeys = {
  all: ['categories'] as const,
  list: () => [...categoryKeys.all, 'list'] as const,
};

export function useCategories() {
  return useQuery({ queryKey: categoryKeys.list(), queryFn: fetchCategories });
}
