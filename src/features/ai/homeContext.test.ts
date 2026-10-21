import { computeHomeFigures } from '@/features/home/figures';

import { homeContext } from './homeContext';

const account = (id: string, kind: 'bank' | 'credit_card', balance: number, transferPriority = 0) => ({
  id,
  name: `本当の名前${id}`,
  kind,
  balance,
  isReserved: false,
  transferPriority,
  isArchived: false,
  includeInAvailable: true,
});

describe('homeContext', () => {
  it('ホームの額を、口座の名前を置き換えて書く', () => {
    const figures = computeHomeFigures({
      today: '2026-10-21',
      accounts: [account('bank', 'bank', 10000), account('saving', 'bank', 50000, 1)],
      employers: [],
      future: [
        {
          id: 'x',
          date: '2026-10-30',
          type: 'expense',
          amount: 30000,
          payee: null,
          from_account_id: 'bank',
          to_account_id: null,
        },
      ],
      periodMovements: [],
      cardSettings: [],
      dailyLiving: 0,
    });
    const text = homeContext(figures, { account: (id) => (id === 'bank' ? '銀行A' : '銀行B') });
    expect(text).toContain('実質残高: 60,000円');
    expect(text).toContain('月末までに使える額: 30,000円');
    expect(text).toContain('足りなくなる口座: 銀行A が 2026-10-30 に −20,000円（振替で足りる（銀行Bから 20,000円））');
    expect(text).not.toContain('本当の名前');
  });
});
