import { fromOpeningBalance, toOpeningBalance } from './accountKinds';

describe('初期残高の符号', () => {
  it('負債（クレカ・借金）はマイナスで保存する', () => {
    expect(toOpeningBalance('credit_card', 15000)).toBe(-15000);
    expect(toOpeningBalance('payable', 20000)).toBe(-20000);
  });

  it('資産・債権はそのまま保存する', () => {
    expect(toOpeningBalance('bank', 120000)).toBe(120000);
    expect(toOpeningBalance('receivable', 800)).toBe(800);
  });

  it('画面表示用には正の値に戻す', () => {
    expect(fromOpeningBalance('credit_card', -15000)).toBe(15000);
    expect(fromOpeningBalance('cash', 8000)).toBe(8000);
  });
});

it('初期残高 0 の負債は -0 にならない', () => {
  expect(Object.is(toOpeningBalance('credit_card', 0), 0)).toBe(true);
});
