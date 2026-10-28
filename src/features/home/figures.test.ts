import type { AccountBalance } from '@/features/accounts/summary';
import type { Movement } from '@/features/reports/api';

import { budgetCard, computeHomeFigures } from './figures';

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

describe('computeHomeFigures', () => {
  it('実質残高は、含める口座の今の残高の合計（クレカの未払いを引く。先の予定は見ない）', () => {
    const future = [m('2026-10-26', 5000, 'bank', null, 'expense')];
    const figures = computeHomeFigures({ today, accounts, employers, future });
    expect(figures.available.amount).toBe(70000);
    // 生活費が読めるまで、給料日までの額は出さない
    expect(figures.budget).toBeNull();
  });

  // 次の給料日は 10/23（25日が日曜なので前の金曜）、その次は 11/25
  const future = [
    m('2026-10-22', 20000, 'bank', null, 'expense'),
    m('2026-10-23', 200000, null, 'bank', 'income'),
    m('2026-10-27', 30000, 'bank', 'card'), // クレカの引き落とし（含める口座どうし → 0）
    m('2026-11-10', 50000, 'bank', null, 'expense'),
  ];

  it('給料日までに残る額 = 実質残高 ＋ 給料日の前日までの予定。自由に使える額はそこから生活費を引く', () => {
    const { budget } = computeHomeFigures({ today, accounts, employers, future, dailyLiving: 3000 });
    expect(budget).toMatchObject({
      through: '2026-10-22',
      daysLeft: 2,
      planned: -20000,
      untilPayday: 50000,
      perDay: 25000,
      livingUntil: 6000,
      free: 44000,
    });
  });

  it('次の期間の予定（給料を含む）で生活費が足りれば、取り置きはしない', () => {
    const { budget } = computeHomeFigures({ today, accounts, employers, future, dailyLiving: 3000 });
    expect(budget!.next).toEqual({ from: '2026-10-23', through: '2026-11-24', days: 33, planned: 150000 });
    expect(budget).toMatchObject({ reserve: 0, afterReserve: 50000 });
  });

  it('足りなければ、その分を取り置き、マイナスなら「足りない額」と言い換える', () => {
    const smallSalary = future.map((x) => (x.type === 'income' ? { ...x, amount: 80000 } : x));
    const { budget } = computeHomeFigures({ today, accounts, employers, future: smallSalary, dailyLiving: 3000 });
    // 生活費 3,000 × 33日 = 99,000、予定 +80,000 − 50,000 = 30,000 → 69,000 足りない
    expect(budget).toMatchObject({ reserve: 69000, afterReserve: -19000 });
    expect(budgetCard(budget!, 'afterReserve')).toEqual({
      title: '取り置き後に使える額',
      shortTitle: '取り置きに足りない額',
      amount: -19000,
    });
    expect(budgetCard(budget!, 'untilPayday').title).toBe('給料日までに残る額');
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
