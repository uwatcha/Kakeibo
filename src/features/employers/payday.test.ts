import { actualPayday, isBusinessDay, lastPayday, nextPayday, scheduledPayday } from './payday';

const before = (payday: number) => ({ payday, payday_shift: 'before' as const });
const after = (payday: number) => ({ payday, payday_shift: 'after' as const });

describe('isBusinessDay', () => {
  it.each([
    ['2026-10-16', true], // 金
    ['2026-10-17', false], // 土
    ['2026-10-18', false], // 日
    ['2026-10-12', false], // スポーツの日
    ['2026-09-22', false], // 国民の休日
    ['2026-12-31', false], // 年末
    ['2027-01-04', true],
  ])('%s → %s', (date, expected) => {
    expect(isBusinessDay(date)).toBe(expected);
  });
});

describe('scheduledPayday', () => {
  it('31 日は月末として扱う', () => {
    expect(scheduledPayday(2026, 2, 31)).toBe('2026-02-28');
    expect(scheduledPayday(2028, 2, 31)).toBe('2028-02-29');
    expect(scheduledPayday(2026, 4, 31)).toBe('2026-04-30');
  });
});

describe('actualPayday', () => {
  it('平日ならそのまま', () => {
    expect(actualPayday(2026, 9, before(25))).toBe('2026-09-25');
  });

  it('日曜は前倒しで金曜、後ろ倒しで月曜', () => {
    expect(actualPayday(2026, 10, before(25))).toBe('2026-10-23');
    expect(actualPayday(2026, 10, after(25))).toBe('2026-10-26');
  });

  it('祝日の連休（シルバーウィーク）をまたいでずらす', () => {
    expect(actualPayday(2026, 9, before(21))).toBe('2026-09-18');
    expect(actualPayday(2026, 9, after(21))).toBe('2026-09-24');
  });

  it('月末が土曜なら前の金曜', () => {
    expect(actualPayday(2026, 2, before(31))).toBe('2026-02-27');
  });

  it('年末年始をまたいで月がずれる', () => {
    expect(actualPayday(2026, 1, before(1))).toBe('2025-12-30');
    expect(actualPayday(2026, 1, after(1))).toBe('2026-01-05');
  });
});

describe('lastPayday / nextPayday', () => {
  const employers = [
    { name: 'バイトA', ...before(25) },
    { name: 'バイトB', ...after(10) },
  ];

  it('複数の働き先からいちばん近い給料日を選ぶ', () => {
    // 10/10 は土曜 → B は 10/13（10/12 は祝日）
    expect(lastPayday(employers, '2026-10-18')).toEqual({ date: '2026-10-13', employer: employers[1] });
    expect(nextPayday(employers, '2026-10-18')).toEqual({ date: '2026-10-23', employer: employers[0] });
  });

  it('給料日当日は「前回の給料日」に含める', () => {
    expect(lastPayday(employers, '2026-10-23')?.date).toBe('2026-10-23');
    expect(nextPayday(employers, '2026-10-23')?.date).toBe('2026-11-10');
  });

  it('働き先がなければ null', () => {
    expect(lastPayday([], '2026-10-18')).toBeNull();
    expect(nextPayday([], '2026-10-18')).toBeNull();
  });
});
