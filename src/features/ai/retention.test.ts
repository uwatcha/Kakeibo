import { daysUntilDeletion, deletionCutoff, needsAutoTitle, titleFrom } from './retention';

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

describe('needsAutoTitle', () => {
  const at = (created_at: string, updated_at: string, title_generated_at: string | null) => ({
    created_at,
    updated_at,
    title_generated_at,
  });
  it('まだ付けていない会話は、作ってから1日たったら', () => {
    expect(needsAutoTitle(at('2026-10-20T12:00:00Z', '2026-10-20T12:00:00Z', null), now)).toBe(true);
    expect(needsAutoTitle(at('2026-10-20T13:00:00Z', '2026-10-20T13:00:00Z', null), now)).toBe(false);
  });
  it('付けたことがある会話は、そのあとにやりとりがあり、付けてから1日たったら', () => {
    expect(needsAutoTitle(at('2026-10-01T00:00:00Z', '2026-10-21T00:00:00Z', '2026-10-20T00:00:00Z'), now)).toBe(true);
    // やりとりがない
    expect(needsAutoTitle(at('2026-10-01T00:00:00Z', '2026-10-19T00:00:00Z', '2026-10-20T00:00:00Z'), now)).toBe(false);
    // 付けてから1日たっていない
    expect(needsAutoTitle(at('2026-10-01T00:00:00Z', '2026-10-21T12:00:00Z', '2026-10-21T00:00:00Z'), now)).toBe(false);
  });
});
