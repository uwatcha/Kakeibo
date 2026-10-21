import type { AccountBalance } from '@/features/accounts/summary';
import type { Movement } from '@/features/reports/api';

import { computeHomeFigures, currentPeriodStart, untilPaydayLabel } from './figures';

const account = (id: string, kind: AccountBalance['kind'], balance: number, extra: Partial<AccountBalance> = {}) => ({
  id,
  name: id,
  kind,
  balance,
  isReserved: false,
  transferPriority: 0,
  isArchived: false,
  includeInAvailable: true,
  ...extra,
});
const m = (
  date: string,
  amount: number,
  from: string | null,
  to: string | null,
  type: Movement['type'] = 'transfer',
) => ({
  id: `${date}-${amount}-${from}-${to}`,
  date,
  type,
  amount,
  payee: null,
  from_account_id: from,
  to_account_id: to,
});

const today = '2026-10-21';
const employers = [{ payday: 25, payday_shift: 'before' as const }];
const accounts = [
  account('bank', 'bank', 100000),
  account('card', 'credit_card', -30000),
  account('nisa', 'investment', 50000, { includeInAvailable: false }),
];

describe('currentPeriodStart', () => {
  it('前回の給料日。働き先がなければ月の初め', () => {
    expect(currentPeriodStart(employers, today)).toBe('2026-09-25');
    expect(currentPeriodStart([], today)).toBe('2026-10-01');
  });
});

describe('computeHomeFigures', () => {
  it('実質残高は、含めるクレカのいちばん後の引き落とし日までの予定を含める', () => {
    const future = [
      m('2026-10-27', 30000, 'bank', 'card'), // 引き落とし（含める口座どうし → 0）
      m('2026-10-26', 5000, 'bank', null), // 引き落としより前の支払い → 含める
      m('2026-11-01', 9000, 'bank', null), // 引き落としより後 → 含めない
    ];
    const figures = computeHomeFigures({ today, accounts, employers, future });
    expect(figures.available).toMatchObject({ cardHorizon: '2026-10-27', planned: -5000, amount: 65000 });
    // 材料がそろうまで使える額は出さない
    expect(figures.budget).toBeNull();
  });

  it('使える額は、含める資産の口座だけで計算し、給料日の前日までの日数で1日あたりを出す', () => {
    const figures = computeHomeFigures({
      today,
      accounts,
      employers,
      future: [m('2026-10-23', 20000, 'bank', null)],
      periodMovements: [],
      cardSettings: [],
      dailyLiving: 0,
    });
    // 次の給料日は 10/23（25日が日曜なので前の金曜）
    expect(figures.budget).toMatchObject({ through: '2026-10-22', daysLeft: 2, cashBalance: 100000 });
    expect(figures.budget!.result.untilPayday).toBe(100000);
    expect(untilPaydayLabel(figures.budget!)).toEqual({
      label: '次の給料日までに残る額',
      amount: 100000,
      short: false,
    });
  });

  it('予定で残高がマイナスになる口座を出し、振替に使う口座から足りるか見る', () => {
    const withSaving = [...accounts, account('saving', 'bank', 80000, { transferPriority: 1 })];
    const figures = computeHomeFigures({
      today,
      accounts: withSaving,
      employers,
      future: [m('2026-10-30', 120000, 'bank', null, 'expense')],
    });
    expect(figures.shortages.map((s) => [s.accountId, s.lowest])).toEqual([['bank', -20000]]);
    expect(figures.covers.get('bank')).toMatchObject({
      covered: true,
      sources: [{ accountId: 'saving', amount: 20000 }],
    });
  });
});
