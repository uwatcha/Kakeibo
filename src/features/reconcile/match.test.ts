import { reconcile, type ReconcileRecord, type StatementRow, toStatementRows } from './match';

const row = (key: string, date: string, amount: number, direction: 'out' | 'in' = 'out'): StatementRow => ({
  key,
  date,
  direction,
  amount,
  description: null,
});
const record = (id: string, date: string, amount: number, over: Partial<ReconcileRecord> = {}): ReconcileRecord => ({
  id,
  date,
  direction: 'out',
  amount,
  listPrice: null,
  payee: null,
  type: 'expense',
  isConfirmed: true,
  ...over,
});

describe('reconcile', () => {
  it('向き・金額が同じで日付が3日以内なら結び付け、残りを「記録にない」「明細にない」に分ける', () => {
    const result = reconcile(
      [row('a', '2026-11-16', 2000), row('b', '2026-11-20', 5500), row('c', '2026-11-20', 50000, 'in')],
      [
        record('x', '2026-11-15', 2000),
        record('y', '2026-11-20', 50000, { direction: 'in' }),
        record('z', '2026-11-18', 700),
      ],
    );
    expect(result.matched.map((m) => [m.row.key, m.record.id])).toEqual([
      ['a', 'x'],
      ['c', 'y'],
    ]);
    expect(result.missing.map((r) => r.key)).toEqual(['b']);
    expect(result.extra.map((r) => r.id)).toEqual(['z']);
  });

  it('同じ金額が続くときは、日付の近いものどうしを結び付ける', () => {
    const result = reconcile(
      [row('a', '2026-11-09', 140), row('b', '2026-11-10', 140)],
      [record('x', '2026-11-10', 140), record('y', '2026-11-09', 140)],
    );
    expect(result.matched.map((m) => [m.row.key, m.record.id])).toEqual([
      ['a', 'y'],
      ['b', 'x'],
    ]);
  });

  it('向きが違う・日付が4日以上ずれる記録は結び付けない', () => {
    const result = reconcile(
      [row('a', '2026-11-10', 1000)],
      [record('x', '2026-11-10', 1000, { direction: 'in' }), record('y', '2026-11-05', 1000)],
    );
    expect(result.matched).toEqual([]);
    expect(result.missing.map((r) => r.key)).toEqual(['a']);
  });

  it('ポイントで一部を払った支払いは、本来の金額でも結び付ける', () => {
    const result = reconcile([row('a', '2026-11-16', 100)], [record('x', '2026-11-16', 60, { listPrice: 100 })]);
    expect(result.matched).toHaveLength(1);
  });

  it('明細の期間の外の記録は「明細にない」に出さない', () => {
    const result = reconcile([row('a', '2026-11-10', 100)], [record('x', '2026-11-01', 300)]);
    expect(result.extra).toEqual([]);
  });
});

describe('toStatementRows', () => {
  it('形がおかしい行を捨てる', () => {
    expect(
      toStatementRows([
        { date: '2026-11-16', direction: 'out', amount: 2000, description: ' 積立 ' },
        { date: '11/16', direction: 'out', amount: 1 },
        { date: '2026-11-16', direction: 'x', amount: 1 },
        { date: '2026-11-16', direction: 'in', amount: 0 },
      ]),
    ).toEqual([{ key: '0', date: '2026-11-16', direction: 'out', amount: 2000, description: '積立' }]);
  });
});
