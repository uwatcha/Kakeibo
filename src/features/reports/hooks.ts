import { useQuery } from '@tanstack/react-query';

import { fetchMovementsAfter } from './api';

// 記録を変更したときに ['reports'] ごと再取得される（transactions/hooks.ts）
export const reportKeys = {
  all: ['reports'] as const,
  movementsAfter: (date: string) => [...reportKeys.all, 'movementsAfter', date] as const,
};

export function useMovementsAfter(date: string | undefined) {
  return useQuery({
    queryKey: reportKeys.movementsAfter(date ?? ''),
    queryFn: () => fetchMovementsAfter(date!),
    enabled: !!date,
  });
}
