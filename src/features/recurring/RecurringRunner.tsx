import { useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { AppState } from 'react-native';

import { useAuth } from '@/features/auth/AuthProvider';
import { generateSalaryPlans } from '@/features/employers/salaryPlans';
import { toTokyoDateString } from '@/lib/date';

import { generateDueTransactions } from './api';

/** ログイン中、アプリを開いたとき・前面に戻ったときに定期支払いの記録と給料の予定を追加する（画面には何も出さない） */
export function RecurringRunner() {
  const { session } = useAuth();
  const queryClient = useQueryClient();
  const userId = session?.user.id;

  useEffect(() => {
    if (!userId) return;
    let running = false;
    const run = async () => {
      if (running) return;
      running = true;
      try {
        const today = toTokyoDateString();
        // 定期支払いと、働き先の給料の予定（2か月先まで）を入れる
        const added = (await generateDueTransactions(today)) + (await generateSalaryPlans(today));
        if (added > 0) await queryClient.invalidateQueries();
      } catch {
        // 通信できないときは次に開いたときにまた試す
      } finally {
        running = false;
      }
    };
    run();
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') run();
    });
    return () => subscription.remove();
  }, [userId, queryClient]);

  return null;
}
