import { normalizeAccounts, type TransactionDraft, validateDraft } from './transactionRules';

const accounts = [
  { id: 'wallet', kind: 'cash' as const },
  { id: 'bank', kind: 'bank' as const },
  { id: 'card', kind: 'credit_card' as const },
  { id: 'friend', kind: 'receivable' as const },
  { id: 'parent', kind: 'payable' as const },
];
const categories = [
  { id: 'food', kind: 'expense' as const },
  { id: 'allowance', kind: 'income' as const },
];

function draft(overrides: Partial<TransactionDraft>): TransactionDraft {
  return {
    type: 'expense',
    amount: 1200,
    fromAccountId: 'wallet',
    toAccountId: null,
    adjustmentDirection: 'increase',
    categoryId: null,
    date: '2026-10-18',
    ...overrides,
  };
}

const validate = (d: Partial<TransactionDraft>) => validateDraft(draft(d), accounts, categories);

describe('validateDraft', () => {
  it('正しい支払いは通る', () => {
    expect(validate({ categoryId: 'food' })).toEqual({});
  });

  it('クレカでの支払いは通る（REQ-33 の1段階目）', () => {
    expect(validate({ fromAccountId: 'card' })).toEqual({});
  });

  it('銀行 → クレカの振替（引き落とし）は通る', () => {
    expect(validate({ type: 'transfer', fromAccountId: 'bank', toAccountId: 'card' })).toEqual({});
  });

  it('クレカから振替はできない', () => {
    expect(validate({ type: 'transfer', fromAccountId: 'card', toAccountId: 'bank' }).fromAccountId).toBeDefined();
  });

  it('金額は1円以上', () => {
    expect(validate({ amount: 0 }).amount).toBeDefined();
    expect(validate({ amount: null }).amount).toBeDefined();
  });

  it('支払い元がなければエラー', () => {
    expect(validate({ fromAccountId: null }).fromAccountId).toBe('支払い元を選んでください');
  });

  it('立て替えの入金先は貸している相手だけ', () => {
    expect(validate({ type: 'advance', fromAccountId: 'card', toAccountId: 'friend' })).toEqual({});
    expect(validate({ type: 'advance', fromAccountId: 'wallet', toAccountId: 'bank' }).toAccountId).toBeDefined();
  });

  it('借金は借りている相手から口座へ', () => {
    expect(validate({ type: 'borrow', fromAccountId: 'parent', toAccountId: 'bank' })).toEqual({});
    expect(validate({ type: 'borrow', fromAccountId: 'friend', toAccountId: 'bank' }).fromAccountId).toBeDefined();
  });

  it('出金元と入金先が同じならエラー', () => {
    expect(validate({ type: 'transfer', fromAccountId: 'bank', toAccountId: 'bank' }).toAccountId).toBeDefined();
  });

  it('支払いに収入カテゴリは付けられない', () => {
    expect(validate({ categoryId: 'allowance' }).categoryId).toBeDefined();
  });

  it('振替にはカテゴリを付けられない', () => {
    expect(
      validate({ type: 'transfer', fromAccountId: 'bank', toAccountId: 'wallet', categoryId: 'food' }).categoryId,
    ).toBeDefined();
  });

  it('残高調整は片方の口座だけで通る', () => {
    expect(validate({ type: 'adjustment', adjustmentDirection: 'decrease', fromAccountId: 'wallet' })).toEqual({});
    expect(validate({ type: 'adjustment', adjustmentDirection: 'increase', fromAccountId: 'wallet' })).toEqual({});
  });
});

describe('normalizeAccounts', () => {
  it('支払いに切り替えたら入金先を外す', () => {
    expect(normalizeAccounts(draft({ type: 'expense', fromAccountId: 'bank', toAccountId: 'wallet' }))).toEqual({
      fromAccountId: 'bank',
      toAccountId: null,
    });
  });

  it('残高調整は向きに合わせて片方に寄せる', () => {
    const d = draft({ type: 'adjustment', fromAccountId: 'wallet', toAccountId: null });
    expect(normalizeAccounts({ ...d, adjustmentDirection: 'increase' })).toEqual({
      fromAccountId: null,
      toAccountId: 'wallet',
    });
    expect(normalizeAccounts({ ...d, adjustmentDirection: 'decrease' })).toEqual({
      fromAccountId: 'wallet',
      toAccountId: null,
    });
  });
});
