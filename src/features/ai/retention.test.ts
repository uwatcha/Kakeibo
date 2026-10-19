import { daysUntilDeletion, deletionCutoff, titleFrom } from './retention';

const now = new Date('2026-10-21T12:00:00Z');

describe('daysUntilDeletion', () => {
  it('最後のやりとりから14日で消える', () => {
    expect(daysUntilDeletion('2026-10-21T12:00:00Z', now)).toBe(14);
    expect(daysUntilDeletion('2026-10-08T11:00:00Z', now)).toBe(1); // 残り23時間
    expect(daysUntilDeletion('2026-10-01T00:00:00Z', now)).toBe(0);
  });
});

describe('deletionCutoff', () => {
  it('14日前の時刻', () => {
    expect(deletionCutoff(now)).toBe('2026-10-07T12:00:00.000Z');
  });
});

describe('titleFrom', () => {
  it('1行目を30文字まで', () => {
    expect(titleFrom('  今月使いすぎ？\n詳しく')).toBe('今月使いすぎ？');
    expect(titleFrom('あ'.repeat(31))).toBe(`${'あ'.repeat(30)}…`);
  });
});
