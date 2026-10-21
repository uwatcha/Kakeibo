import { computeBudget, estimateDailyLiving } from './budget';

const m = (date: string, amount: number, from: string | null, to: string | null) => ({
  id: `${date}-${amount}`,
  date,
  type: 'transfer' as const,
  amount,
  payee: null,
  from_account_id: from,
  to_account_id: to,
});
const isCash = (id: string) => id === 'bank';

// 説明の例: 今の残高 10万、給料日まで1週間、次の給料 15万、生活費 1日2,000円
const base = {
  today: '2026-10-16',
  cashBalance: 100000,
  isCash,
  paydays: ['2026-10-23', '2026-11-25', '2026-12-25'],
  dailyLiving: 2000,
};

describe('computeBudget', () => {
  it('今の期間のクレカ利用は今の額から引き、次の給料で払える請求は引かない', () => {
    const movements = [
      m('2026-10-23', 150000, null, 'bank'), // 給料
      m('2026-10-27', 50000, 'bank', 'card'), // 先月分の請求
      m('2026-10-27', 35000, 'bank', null), // 家賃
      m('2026-11-25', 150000, null, 'bank'),
    ];
    const budget = computeBudget({
      ...base,
      dailyLiving: 1000,
      movements,
      currentCardUsage: [{ amount: 20000, paymentDate: '2026-11-27' }],
    });
    expect(budget.cardUsage).toBe(20000);
    expect(budget.reserve).toBe(0);
    expect(budget.amount).toBe(80000);
  });

  it('次の給料で払いきれない分を取り置く', () => {
    const movements = [
      m('2026-10-23', 150000, null, 'bank'),
      m('2026-10-27', 120000, 'bank', 'card'),
      m('2026-10-27', 35000, 'bank', null),
      m('2026-11-25', 150000, null, 'bank'),
    ];
    const budget = computeBudget({ ...base, movements, currentCardUsage: [] });
    // 10/23〜11/24 の33日: 150,000 − 120,000 − 35,000 − 66,000 = −71,000
    expect(budget.shortfalls[0]).toEqual({ from: '2026-10-23', to: '2026-11-24', amount: 71000 });
    expect(budget.amount).toBe(100000 - 71000);
    // 次の給料日までなら、先の不足は関係ない
    expect(budget.untilPayday).toBe(100000);
  });

  it('給料日より前の引き落としは今のお金から払う（今の期間の利用でも二重には引かない）', () => {
    const movements = [m('2026-10-20', 30000, 'bank', 'card')];
    const budget = computeBudget({
      ...base,
      dailyLiving: 0,
      movements,
      currentCardUsage: [{ amount: 10000, paymentDate: '2026-10-20' }],
    });
    expect(budget.planned).toBe(-30000);
    expect(budget.cardUsage).toBe(0);
    expect(budget.amount).toBe(70000);
    expect(budget.untilPayday).toBe(70000);
  });

  it('今の期間に使った分が入っている先の請求は、その分を除いて不足を見る', () => {
    const movements = [m('2026-11-27', 60000, 'bank', 'card'), m('2026-11-25', 30000, null, 'bank')];
    const budget = computeBudget({
      ...base,
      dailyLiving: 0,
      movements,
      currentCardUsage: [{ amount: 20000, paymentDate: '2026-11-27' }],
    });
    // 11/25〜12/24: 40,000 − 60,000 + 20,000（今の額から引いて残した分）= 0 → 不足なし
    expect(budget.reserve).toBe(0);
    expect(budget.amount).toBe(80000);
  });
});

describe('estimateDailyLiving', () => {
  it('定期支払いを除いた支払いの1日あたりの平均', () => {
    const expenses = [
      { date: '2026-10-12', amount: 3000, recurring: false },
      { date: '2026-10-15', amount: 1000, recurring: false },
      { date: '2026-10-14', amount: 50000, recurring: true },
    ];
    // 10/12〜10/21 の10日
    expect(estimateDailyLiving(expenses, '2026-10-21')).toBe(400);
  });
});
