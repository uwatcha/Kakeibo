import { cardStatements } from './cardStatements';

// サンプルカード: 月末締め・翌月27日払い
const schedule = { closing_day: 31, payment_day: 27, payment_month_offset: 1 };

describe('cardStatements', () => {
  it('使い始めの未払いは次の引き落としの回、以降の利用は締め日で回に分ける', () => {
    const charges = [
      { date: '2026-10-20', amount: 1000 },
      { date: '2026-10-31', amount: 500 },
      { date: '2026-11-01', amount: 300 },
    ];
    expect(cardStatements(schedule, charges, { unpaid: 36000, since: '2026-10-18' }, '2026-10-20')).toEqual([
      { closingDate: '2026-11-30', paymentDate: '2026-12-28', amount: 300, isOpen: true },
      { closingDate: '2026-10-31', paymentDate: '2026-11-27', amount: 1500, isOpen: true },
      { closingDate: '2026-09-30', paymentDate: '2026-10-27', amount: 36000, isOpen: false },
    ]);
  });

  it('利用がなくても今の回は 0 円で出す', () => {
    expect(cardStatements(schedule, [], null, '2026-10-20')).toEqual([
      { closingDate: '2026-10-31', paymentDate: '2026-11-27', amount: 0, isOpen: true },
    ]);
  });

  it('15日締め・翌々月10日払い', () => {
    const s = { closing_day: 15, payment_day: 10, payment_month_offset: 2 };
    const result = cardStatements(s, [{ date: '2026-10-16', amount: 100 }], null, '2026-10-16');
    expect(result).toEqual([{ closingDate: '2026-11-15', paymentDate: '2027-01-12', amount: 100, isOpen: true }]);
  });
});
