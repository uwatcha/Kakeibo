import { monthStart, toTokyoDateString } from './date';

describe('toTokyoDateString', () => {
  it('UTC では前日でも日本時間の日付を返す', () => {
    expect(toTokyoDateString(new Date('2026-10-17T15:30:00Z'))).toBe('2026-10-18');
  });

  it('日本時間の 0 時前は前日のまま', () => {
    expect(toTokyoDateString(new Date('2026-10-17T14:59:59Z'))).toBe('2026-10-17');
  });
});

describe('monthStart', () => {
  it('月初を返す', () => {
    expect(monthStart('2026-10-18')).toBe('2026-10-01');
  });
});
