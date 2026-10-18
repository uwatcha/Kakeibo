import { summarizeBalances, type AccountBalance } from './summary';

let seq = 0;
function account(overrides: Partial<AccountBalance>): AccountBalance {
  seq += 1;
  return {
    id: `a${seq}`,
    name: `口座${seq}`,
    kind: 'bank',
    isReserved: false,
    isArchived: false,
    sortOrder: seq,
    balance: 0,
    ...overrides,
  };
}

describe('summarizeBalances', () => {
  const wallet = account({ name: '財布', kind: 'cash', balance: 8000 });
  const bank = account({ name: '銀行', kind: 'bank', balance: 120000 });
  const nisa = account({ name: 'NISA', kind: 'investment', balance: 300000, isReserved: true });
  const card = account({ name: 'クレカ', kind: 'credit_card', balance: -15000 });
  const parent = account({ name: '親', kind: 'payable', balance: -20000 });
  const friend = account({ name: '友人', kind: 'receivable', balance: 800 });
  const oldBank = account({ name: '旧口座', kind: 'bank', balance: 500, isArchived: true });

  const summary = summarizeBalances([wallet, bank, nisa, card, parent, friend, oldBank]);

  it('純資産は負債を差し引き、非表示の口座も含める', () => {
    expect(summary.netWorth).toBe(8000 + 120000 + 300000 - 15000 - 20000 + 800 + 500);
  });

  it('普段使う口座と普段使わない口座を分ける', () => {
    expect(summary.everyday.map((a) => a.name)).toEqual(['財布', '銀行']);
    expect(summary.everydayTotal).toBe(128000);
    expect(summary.reserved.map((a) => a.name)).toEqual(['NISA']);
    expect(summary.reservedTotal).toBe(300000);
  });

  it('クレカの未払い額と借りている額は正の値で返す', () => {
    expect(summary.creditCardUnpaid).toBe(15000);
    expect(summary.payableTotal).toBe(20000);
    expect(summary.receivableTotal).toBe(800);
  });

  it('非表示の口座は一覧に出さない', () => {
    const names = [...summary.everyday, ...summary.reserved].map((a) => a.name);
    expect(names).not.toContain('旧口座');
  });

  it('並び順は sortOrder 優先', () => {
    const a = account({ name: 'B', sortOrder: 1 });
    const b = account({ name: 'A', sortOrder: 2 });
    expect(summarizeBalances([b, a]).everyday.map((x) => x.name)).toEqual(['B', 'A']);
  });

  it('口座がなければすべて 0', () => {
    const empty = summarizeBalances([]);
    expect(empty.netWorth).toBe(0);
    expect(empty.creditCardUnpaid).toBe(0);
    expect(empty.everyday).toEqual([]);
  });
});
