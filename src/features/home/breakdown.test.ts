import type { AccountBalance } from '@/features/accounts/summary';
import type { Movement } from '@/features/reports/api';

import { homeSheet } from './breakdown';
import type { Formula } from './components/BreakdownSheet';
import { computeHomeFigures } from './figures';

const account = (id: string, kind: AccountBalance['kind'], balance: number) => ({
  id,
  name: id,
  kind,
  balance,
  isReserved: false,
  transferPriority: 0,
  isArchived: false,
  includeInAvailable: true,
});
const m = (date: string, amount: number, from: string | null, to: string | null, type: Movement['type']) => ({
  id: `${date}-${amount}`,
  date,
  type,
  amount,
  payee: null,
  from_account_id: from,
  to_account_id: to,
});

const today = '2026-10-21';
const accounts = [account('bank', 'bank', 100000), account('card', 'credit_card', -30000)];
const future = [
  m('2026-10-22', 20000, 'bank', null, 'expense'),
  m('2026-10-23', 80000, null, 'bank', 'income'),
  m('2026-11-10', 50000, 'bank', null, 'expense'),
];
const figures = computeHomeFigures({
  today,
  accounts,
  employers: [{ payday: 25, payday_shift: 'before' }],
  future,
  dailyLiving: 3000,
});

/** 式の項を順に計算した値（「マイナスなら 0」は式の外なので、ここでは見ない） */
const evaluate = (f: Formula) =>
  f.terms.reduce((acc, t, i) => {
    if (i === 0) return t.value;
    if (t.op === '＋') return acc + t.value;
    if (t.op === '−') return acc - t.value;
    return acc * t.value;
  }, 0);

describe('ホームの内訳の計算式', () => {
  it.each(['available', 'net', 'untilPayday', 'afterReserve', 'free'] as const)(
    '%s: 式を計算すると表示の額になる',
    (key) => {
      const sheet = homeSheet(key, figures, accounts, future, today)!;
      expect(evaluate(sheet.formulas![0])).toBe(sheet.total);
    },
  );

  it('取り置き・給料日までの生活費の式も、その値になる', () => {
    const after = homeSheet('afterReserve', figures, accounts, future, today)!;
    // 生活費 3,000 × 33日 − 予定（+80,000 − 50,000）= 69,000
    expect(evaluate(after.formulas![1])).toBe(figures.budget!.reserve);
    const free = homeSheet('free', figures, accounts, future, today)!;
    expect(free.formulas![1].terms.map((t) => [t.label, t.value])).toEqual([
      ['生活費（1日）', 3000],
      ['給料日までの日数', 2],
    ]);
    expect(evaluate(free.formulas![1])).toBe(figures.budget!.livingUntil);
  });
});
