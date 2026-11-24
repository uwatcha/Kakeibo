import { settleAdjustment } from './settle';

describe('settleAdjustment', () => {
  it('プラス（返ってきていない分）は減らし、マイナス（多く返してもらった）は増やす', () => {
    expect(settleAdjustment(3)).toEqual({ direction: 'decrease', amount: 3 });
    expect(settleAdjustment(-200)).toEqual({ direction: 'increase', amount: 200 });
  });

  it('0 円なら何もしない', () => {
    expect(settleAdjustment(0)).toBeNull();
  });
});
