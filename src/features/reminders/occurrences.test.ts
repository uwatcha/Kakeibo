import { nextOccurrences } from './occurrences';

const iso = (dates: Date[]) => dates.map((d) => d.toISOString());

describe('nextOccurrences', () => {
  // 2026-11-24 10:00（日本時間）
  const now = Date.parse('2026-11-24T10:00:00+09:00');

  it('変えた日の次の回から、間隔ごとの決めた時刻（日本時間）', () => {
    expect(iso(nextOccurrences('2026-11-24', 3, 21, now, 3))).toEqual([
      '2026-11-27T12:00:00.000Z',
      '2026-11-30T12:00:00.000Z',
      '2026-12-03T12:00:00.000Z',
    ]);
  });

  it('前に決めた間隔は、過ぎた回を飛ばして続ける（今日の回がまだなら今日）', () => {
    expect(iso(nextOccurrences('2026-11-10', 7, 21, now, 2))).toEqual([
      '2026-11-24T12:00:00.000Z',
      '2026-12-01T12:00:00.000Z',
    ]);
    // 今日の回の時刻が過ぎていれば次の回から
    expect(iso(nextOccurrences('2026-11-10', 7, 8, now, 1))).toEqual(['2026-11-30T23:00:00.000Z']);
  });

  it('しない（0日）なら予約しない', () => {
    expect(nextOccurrences('2026-11-24', 0, 21, now, 3)).toEqual([]);
  });
});
