import { settleTransfer } from './settle';

const accounts = [
  { id: 'cash', kind: 'cash' as const, is_archived: false },
  { id: 'bank', kind: 'bank' as const, is_archived: false },
  { id: 'card', kind: 'credit_card' as const, is_archived: false },
  { id: 'p', kind: 'receivable' as const, is_archived: false },
];

describe('settleTransfer', () => {
  const history = [
    { from_account_id: 'p', to_account_id: 'bank' },
    { from_account_id: 'cash', to_account_id: 'p' },
    { from_account_id: 'p', to_account_id: 'bank' },
    { from_account_id: 'card', to_account_id: 'p' },
  ];

  it('プラスなら相手 → いちばん多く使った口座（クレカは使わない）', () => {
    expect(settleTransfer('p', 3, history, accounts)).toEqual({ from: 'p', to: 'bank', amount: 3 });
  });

  it('マイナスなら自分の口座 → 相手（正の額）', () => {
    expect(settleTransfer('p', -500, history, accounts)).toEqual({ from: 'bank', to: 'p', amount: 500 });
  });

  it('同じ数なら新しい記録の口座、記録がなければ現金', () => {
    const tie = [
      { from_account_id: 'p', to_account_id: 'bank' },
      { from_account_id: 'cash', to_account_id: 'p' },
    ];
    expect(settleTransfer('p', 3, tie, accounts)?.to).toBe('bank');
    expect(settleTransfer('p', 3, [], accounts)?.to).toBe('cash');
  });

  it('0 円なら何もしない', () => {
    expect(settleTransfer('p', 0, history, accounts)).toBeNull();
  });
});
