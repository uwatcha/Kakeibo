import { useAccountBalances, useAllCardSettings } from '@/features/accounts/hooks';
import { useEmployers } from '@/features/employers/hooks';
import { useMovementsAfter } from '@/features/reports/hooks';
import { useDailyLiving } from '@/features/settings/hooks';

import { computeHomeFigures, type HomeFigures } from './figures';

/**
 * ホームのカードと足りなくなる口座の計算（ホームと AI 相談で使う）。
 * figures は口座の残高が読めたら出す。予定などがまだなら、その分は空のまま（読めたら計算し直す）
 */
export function useHomeFigures(today: string) {
  const balances = useAccountBalances();
  const employers = useEmployers();
  const future = useMovementsAfter(today);
  const living = useDailyLiving(today);
  const cards = useAllCardSettings();
  const activeEmployers = employers.data?.filter((e) => !e.is_archived) ?? [];

  const figures: HomeFigures | null = balances.data
    ? computeHomeFigures({
        today,
        accounts: balances.data,
        employers: activeEmployers,
        future: future.data,
        dailyLiving: living.ready ? living.daily : undefined,
        cardSchedules: cards.data ? new Map(cards.data.map((c) => [c.account_id, c])) : undefined,
      })
    : null;
  return { balances, future, figures };
}
