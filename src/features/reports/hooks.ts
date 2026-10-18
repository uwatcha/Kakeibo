import { useQuery } from '@tanstack/react-query';

import { addMonths } from '@/lib/date';

import { fetchCategoryExpense, fetchMonthlyTotals } from './api';

// 記録を変更したときに ['reports'] ごと再取得される（transactions/hooks.ts）
export const reportKeys = {
  all: ['reports'] as const,
  totals: (month: string) => [...reportKeys.all, 'totals', month] as const,
  categoryExpense: (month: string) => [...reportKeys.all, 'categoryExpense', month] as const,
};

/** その月と前月の収入・支出 */
export function useMonthComparison(month: string) {
  const previous = addMonths(month, -1);
  return useQuery({
    queryKey: reportKeys.totals(month),
    queryFn: async () => {
      const totals = await fetchMonthlyTotals([month, previous]);
      return { current: totals[month], previous: totals[previous] };
    },
  });
}

export function useCategoryExpense(month: string) {
  return useQuery({ queryKey: reportKeys.categoryExpense(month), queryFn: () => fetchCategoryExpense(month) });
}
