import { defaultTypeForAccount, presetSide } from './accountPreset';

describe('defaultTypeForAccount', () => {
  it('財布・銀行・クレカは支払い', () => {
    expect(defaultTypeForAccount('cash')).toBe('expense');
    expect(defaultTypeForAccount('credit_card')).toBe('expense');
  });
  it('貸している相手は立て替え、借りている相手は借金', () => {
    expect(defaultTypeForAccount('receivable')).toBe('advance');
    expect(defaultTypeForAccount('payable')).toBe('borrow');
  });
});

describe('presetSide', () => {
  it('出る側を優先し、入る側しかなければ入る側', () => {
    expect(presetSide('expense', 'bank')).toBe('from');
    expect(presetSide('income', 'bank')).toBe('to');
    expect(presetSide('transfer', 'credit_card')).toBe('to');
    expect(presetSide('income', 'credit_card')).toBeNull();
    expect(presetSide('transfer', 'receivable')).toBe('from');
  });
});
