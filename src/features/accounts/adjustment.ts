import { type AccountKind, isLiability } from './accountKinds';

export type AdjustmentPlan = {
  /** increase なら to、decrease なら from にこの口座を入れた残高調整を記録する */
  direction: 'increase' | 'decrease';
  amount: number;
};

/**
 * 実際の残高に合わせるための残高調整。
 * actualInput は画面で入れた正の値（負債は未払い額・借りている額）。appBalance は DB の残高（負債はマイナス）。
 * ずれがなければ null。
 */
export function planAdjustment(kind: AccountKind, appBalance: number, actualInput: number): AdjustmentPlan | null {
  const actual = isLiability(kind) ? 0 - actualInput : actualInput;
  const diff = actual - appBalance;
  if (diff === 0) return null;
  return diff > 0 ? { direction: 'increase', amount: diff } : { direction: 'decrease', amount: 0 - diff };
}
