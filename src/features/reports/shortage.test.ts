import { findShortages } from './shortage';

const move = (date: string, amount: number, from: string | null, to: string | null) => ({
  date,
  amount,
  from_account_id: from,
  to_account_id: to,
});

describe('findShortages', () => {
  const balances = new Map([
    ['bank', 31000],
    ['wallet', 7500],
  ]);
  // サンプル銀行の 10 月下旬の予定
  const movements = [
    move('2026-10-23', 48000, null, 'bank'),
    move('2026-10-24', 50000, 'bank', 'father'),
    move('2026-10-26', 5000, 'bank', null),
    move('2026-10-27', 36000, 'bank', 'card'),
    move('2026-10-20', 9000, 'friend', 'wallet'),
  ];

  it('途中でマイナスになる口座と日付、いちばん低い残高', () => {
    expect(findShortages(balances, movements, '2026-10-18', '2026-11-18')).toEqual([
      { accountId: 'bank', date: '2026-10-27', lowest: -12000 },
    ]);
  });

  it('期間外の予定は見ない', () => {
    expect(findShortages(balances, movements, '2026-10-18', '2026-10-26')).toEqual([]);
  });

  it('同じ日の入金で足りるならマイナスにしない', () => {
    const sameDay = [move('2026-10-25', 50000, 'bank', null), move('2026-10-25', 20000, null, 'bank')];
    expect(findShortages(balances, sameDay, '2026-10-18', '2026-10-31')).toEqual([]);
  });

  it('対象でない口座（クレカなど）は見ない', () => {
    expect(findShortages(balances, [move('2026-10-20', 99999, 'card', null)], '2026-10-18', '2026-10-31')).toEqual([]);
  });
});
