import { asMovements } from './movements';

const row = (date: string, is_confirmed: boolean) => ({
  id: date,
  date,
  type: 'collect' as const,
  amount: 9000,
  payee: null,
  from_account_id: 'kenta',
  to_account_id: 'bank',
  is_confirmed,
});

describe('asMovements', () => {
  it('日付が過ぎた未確認の記録は、明日の予定にする', () => {
    expect(asMovements([row('2026-10-20', false)], '2026-10-21')).toEqual(
      [{ ...row('2026-10-22', false), id: '2026-10-20', is_confirmed: undefined, overdue: true }].map(
        ({ is_confirmed: _, ...m }) => m,
      ),
    );
  });
  it('未来の記録と確認済みの記録はそのまま', () => {
    const result = asMovements([row('2026-10-25', false), row('2026-10-21', true)], '2026-10-21');
    expect(result.map((m) => [m.date, m.overdue])).toEqual([
      ['2026-10-25', undefined],
      ['2026-10-21', undefined],
    ]);
  });
});
