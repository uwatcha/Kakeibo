import { planAdjustment } from './adjustment';

describe('planAdjustment', () => {
  it('実際の方が多ければ増やす', () => {
    expect(planAdjustment('cash', 8000, 8500)).toEqual({ direction: 'increase', amount: 500 });
  });

  it('実際の方が少なければ減らす', () => {
    expect(planAdjustment('bank', 120000, 119880)).toEqual({ direction: 'decrease', amount: 120 });
  });

  it('ずれがなければ記録しない', () => {
    expect(planAdjustment('cash', 8000, 8000)).toBeNull();
  });

  it('クレカは未払い額で比べる（未払いが実際は多い → 残高を減らす）', () => {
    // アプリの未払い 15,000、実際の未払い 15,400
    expect(planAdjustment('credit_card', -15000, 15400)).toEqual({ direction: 'decrease', amount: 400 });
  });

  it('借金は借りている額で比べる（実際は少ない → 残高を増やす）', () => {
    expect(planAdjustment('payable', -20000, 15000)).toEqual({ direction: 'increase', amount: 5000 });
  });

  it('マイナスの残高（使いすぎ）から 0 に合わせる', () => {
    expect(planAdjustment('cash', -300, 0)).toEqual({ direction: 'increase', amount: 300 });
  });
});
