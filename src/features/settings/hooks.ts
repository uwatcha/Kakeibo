import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { estimateDailyLiving } from '@/features/reports/budget';
import { addDays } from '@/lib/date';

import { fetchRecentExpenses, fetchUserSettings, saveMonthlyLivingCost } from './api';

export const settingsKeys = {
  all: ['settings'] as const,
  user: () => [...settingsKeys.all, 'user'] as const,
};

export function useUserSettings() {
  return useQuery({ queryKey: settingsKeys.user(), queryFn: fetchUserSettings });
}

export function useSaveMonthlyLivingCost() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: saveMonthlyLivingCost,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: settingsKeys.all }),
  });
}

/** 生活費の1日あたり。設定した1か月の額があればそれ（÷30）、なければ直近90日の記録からの見積もり */
export function useDailyLiving(today: string) {
  const settings = useUserSettings();
  const expenses = useQuery({
    // 記録が変わったら読み直す（transactions のキーの下に置く）
    queryKey: ['transactions', 'recentExpenses', today],
    queryFn: () => fetchRecentExpenses(addDays(today, -89)),
  });
  const estimated = expenses.data ? estimateDailyLiving(expenses.data, today) : null;
  const manual = settings.data?.monthlyLivingCost ?? null;
  return {
    ready: !!settings.data && estimated !== null,
    daily: manual !== null ? Math.round(manual / 30) : (estimated ?? 0),
    estimated,
    manual,
  };
}
