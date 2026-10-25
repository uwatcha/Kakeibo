import { findShortages, lowestAhead, planCovers } from './shortage';

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
      {
        accountId: 'bank',
        date: '2026-10-27',
        lowest: -12000,
        causes: [move('2026-10-27', 36000, 'bank', 'card')],
      },
    ]);
  });

  it('今の残高がマイナスなだけで、その口座から出ていく予定がなければ出さない（ほかの口座の予定の日でも）', () => {
    const negative = new Map([
      ['bank', 1000],
      ['minus', -500],
    ]);
    expect(findShortages(negative, [move('2026-10-21', 300, 'bank', null)], '2026-10-20', '2026-12-31')).toEqual([]);
    const paid = findShortages(negative, [move('2026-10-22', 200, 'minus', null)], '2026-10-20', '2026-12-31');
    expect(paid.map((x) => [x.accountId, x.date, x.lowest])).toEqual([['minus', '2026-10-22', -700]]);
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

describe('lowestAhead / planCovers', () => {
  const m = (date: string, amount: number, from: string | null, to: string | null) => ({
    date,
    amount,
    from_account_id: from,
    to_account_id: to,
  });
  const balances = new Map([
    ['bank', 31000],
    ['wallet', 7500],
    ['paypay', 11000],
  ]);
  const movements = [
    m('2026-10-24', 50000, 'bank', 'father'),
    m('2026-10-27', 36000, 'bank', 'card'),
    m('2026-10-25', 3000, 'wallet', null),
  ];
  const today = '2026-10-20';

  it('今日から先で一番少ないときの残高', () => {
    const lowest = lowestAhead(balances, movements, today);
    expect(lowest.get('bank')).toBe(-55000);
    expect(lowest.get('wallet')).toBe(4500);
    expect(lowest.get('paypay')).toBe(11000);
  });

  it('1つの口座で足りなければ、次の口座も合わせて振り替える', () => {
    const shortages = findShortages(balances, movements, today, '9999-12-31');
    const covers = planCovers(shortages, lowestAhead(balances, movements, today), ['wallet', 'paypay', 'bank']);
    // 55,000 足りないが、財布 4,500 + PayPay 11,000 = 15,500 しか出せない
    expect(covers.get('bank')).toEqual({
      covered: false,
      sources: [
        { accountId: 'wallet', amount: 4500 },
        { accountId: 'paypay', amount: 11000 },
      ],
    });
  });

  it('足りる分だけ前の口座から使う', () => {
    const small = [m('2026-10-27', 32000, 'bank', 'card')];
    const shortages = findShortages(balances, small, today, '9999-12-31');
    const covers = planCovers(shortages, lowestAhead(balances, small, today), ['wallet', 'paypay', 'bank']);
    expect(covers.get('bank')).toEqual({ covered: true, sources: [{ accountId: 'wallet', amount: 1000 }] });
  });

  it('同じ口座の余裕を2つの不足で二重に使わない', () => {
    const two = [m('2026-10-21', 9000, 'paypay', null), m('2026-10-22', 31000, 'bank', null)];
    const b = new Map([
      ['bank', 30000],
      ['paypay', 8000],
      ['wallet', 2000],
    ]);
    const shortages = findShortages(b, two, today, '9999-12-31');
    const covers = planCovers(shortages, lowestAhead(b, two, today), ['wallet', 'paypay', 'bank']);
    expect(covers.get('paypay')).toEqual({ covered: true, sources: [{ accountId: 'wallet', amount: 1000 }] });
    expect(covers.get('bank')).toEqual({ covered: true, sources: [{ accountId: 'wallet', amount: 1000 }] });
  });
});
