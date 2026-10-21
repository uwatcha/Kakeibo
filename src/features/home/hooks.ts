import { useAccountBalances, useAllCardSettings } from '@/features/accounts/hooks';
import { useEmployers } from '@/features/employers/hooks';
import { useMovementsAfter } from '@/features/reports/hooks';
import { useDailyLiving } from '@/features/settings/hooks';
import { addDays } from '@/lib/date';

import { computeHomeFigures, currentPeriodStart, type HomeFigures } from './figures';

/**
 * ホームのカードと足りなくなる口座の計算（ホームと AI 相談で使う）。
 * figures は口座の残高が読めたら出す。予定などがまだなら、その分は空のまま（読めたら計算し直す）
 */
export function useHomeFigures(today: string) {
  const balances = useAccountBalances();
  const employers = useEmployers();
  const future = useMovementsAfter(today);
  const cardSettings = useAllCardSettings();
  const living = useDailyLiving(today);
  const activeEmployers = employers.data?.filter((e) => !e.is_archived) ?? [];
  // 今の期間のクレカの利用を数えるため、期間の始まりの前日より後の記録を読む
  const periodMovements = useMovementsAfter(addDays(currentPeriodStart(activeEmployers, today), -1));

  const figures: HomeFigures | null = balances.data
    ? computeHomeFigures({
        today,
        accounts: balances.data,
        employers: activeEmployers,
        future: future.data,
        periodMovements: periodMovements.data,
        cardSettings: cardSettings.data,
        dailyLiving: living.ready ? living.daily : undefined,
      })
    : null;
  return { balances, future, figures };
}
