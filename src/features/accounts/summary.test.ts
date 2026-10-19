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
    balance: 0,
    includeInAvailable: true,
    ...overrides,
  };
}

describe('summarizeBalances', () => {
  const wallet = account({ name: '財布', kind: 'cash', balance: 8000 });
  const bank = account({ name: '銀行', kind: 'bank', balance: 120000 });
  const nisa = account({
    name: 'NISA',
    kind: 'investment',
    balance: 300000,
    isReserved: true,
    includeInAvailable: false,
  });
  const card = account({ name: 'クレカ', kind: 'credit_card', balance: -15000 });
  const parent = account({ name: '親', kind: 'payable', balance: -20000 });
  const friend = account({ name: '友人', kind: 'receivable', balance: 800 });
  const oldBank = account({ name: '旧口座', kind: 'bank', balance: 500, isArchived: true });

  const summary = summarizeBalances([wallet, bank, nisa, card, parent, friend, oldBank]);

  it('純資産は負債を差し引き、非表示の口座も含める', () => {
    expect(summary.netWorth).toBe(8000 + 120000 + 300000 - 15000 - 20000 + 800 + 500);
  });

  it('汎用資産は含めると選んだ口座だけ（負債は差し引き、含めない NISA は除く）', () => {
    expect(summary.availableNetWorth).toBe(8000 + 120000 - 15000 - 20000 + 800 + 500);
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

  it('普段使わない口座でも、含めると選べば汎用資産に入る', () => {
    const reserved = account({ kind: 'bank', balance: 1000, isReserved: true, includeInAvailable: true });
    const excludedCard = account({ kind: 'credit_card', balance: -500, includeInAvailable: false });
    expect(summarizeBalances([reserved, excludedCard]).availableNetWorth).toBe(1000);
  });

  it('並び順は種類、同じ種類の中は名前順', () => {
    const bank = account({ name: 'A銀行', kind: 'bank' });
    const cashB = account({ name: 'B財布', kind: 'cash' });
    const cashA = account({ name: 'A財布', kind: 'cash' });
    expect(summarizeBalances([bank, cashB, cashA]).everyday.map((x) => x.name)).toEqual(['A財布', 'B財布', 'A銀行']);
  });

  it('普段使わない貸し借りの相手は、貸し借りの欄ではなく普段使わない口座に入る', () => {
    const friend = account({ name: '友達', kind: 'receivable', balance: 1000 });
    const old = account({ name: '昔の同僚', kind: 'receivable', balance: 500, isReserved: true });
    const result = summarizeBalances([friend, old]);
    expect(result.receivables.map((a) => a.name)).toEqual(['友達']);
    expect(result.receivableTotal).toBe(1000);
    expect(result.reserved.map((a) => a.name)).toEqual(['昔の同僚']);
    expect(result.netWorth).toBe(1500);
  });

  it('口座がなければすべて 0', () => {
    const empty = summarizeBalances([]);
    expect(empty.netWorth).toBe(0);
    expect(empty.availableNetWorth).toBe(0);
    expect(empty.creditCardUnpaid).toBe(0);
    expect(empty.everyday).toEqual([]);
  });
});
