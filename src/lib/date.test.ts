import {
  daysInclusive,
  addDays,
  addMonths,
  dateStringToLocalDate,
  formatDay,
  formatMonth,
  localDateToDateString,
  monthStart,
  toTokyoDateString,
} from './date';

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

describe('addMonths', () => {
  it.each([
    ['2026-10-01', 1, '2026-11-01'],
    ['2026-12-01', 1, '2027-01-01'],
    ['2026-01-01', -1, '2025-12-01'],
    ['2026-10-01', -22, '2024-12-01'],
  ])('%s + %d → %s', (start, n, expected) => {
    expect(addMonths(start, n)).toBe(expected);
  });
});

describe('表示', () => {
  it('formatMonth', () => {
    expect(formatMonth('2026-10-01')).toBe('2026年10月');
  });

  it('formatDay は曜日も付ける', () => {
    expect(formatDay('2026-10-18')).toBe('10月18日（日）');
  });

  it('日付ピッカー用の変換は往復で変わらない', () => {
    expect(localDateToDateString(dateStringToLocalDate('2026-02-28'))).toBe('2026-02-28');
  });
});

describe('addDays', () => {
  it.each([
    ['2026-10-18', -1, '2026-10-17'],
    ['2026-03-01', -1, '2026-02-28'],
    ['2026-12-31', 1, '2027-01-01'],
  ])('%s + %d → %s', (date, n, expected) => {
    expect(addDays(date, n)).toBe(expected);
  });
});

describe('daysInclusive', () => {
  it('両端を含めて数える', () => {
    expect(daysInclusive('2026-10-21', '2026-10-21')).toBe(1);
    expect(daysInclusive('2026-10-21', '2026-11-20')).toBe(31);
  });
});
