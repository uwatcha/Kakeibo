import { nextOccurrence, occurrencesBetween } from './schedule';

const monthly27 = { day_of_month: 27, interval_months: 1, start_date: '2026-08-01', holiday_shift: 'none' as const };

describe('occurrencesBetween', () => {
  it('毎月の回を古い順に', () => {
    expect(occurrencesBetween(monthly27, null, '2026-10-31')).toEqual(['2026-08-27', '2026-09-27', '2026-10-27']);
  });

  it('after より後だけ（追加済みの回は作らない）', () => {
    expect(occurrencesBetween(monthly27, '2026-09-27', '2026-11-30')).toEqual(['2026-10-27', '2026-11-27']);
  });

  it('開始日より前の回は作らない', () => {
    expect(occurrencesBetween({ ...monthly27, start_date: '2026-08-28' }, null, '2026-09-30')).toEqual(['2026-09-27']);
  });

  it('休みの日は次の平日（2026/9/27 は日曜）', () => {
    expect(occurrencesBetween({ ...monthly27, holiday_shift: 'after' }, null, '2026-09-30')).toEqual([
      '2026-08-27',
      '2026-09-28',
    ]);
  });

  it('前の平日にずらすと月をまたぐこともある（2026/11/1 は日曜）', () => {
    const first = { day_of_month: 1, interval_months: 1, start_date: '2026-11-01', holiday_shift: 'before' as const };
    expect(occurrencesBetween(first, null, '2026-11-30')).toEqual(['2026-10-30']);
  });

  it('2か月ごと（偶数月の26日）', () => {
    const water = { day_of_month: 26, interval_months: 2, start_date: '2026-08-01', holiday_shift: 'none' as const };
    expect(occurrencesBetween(water, null, '2027-01-31')).toEqual(['2026-08-26', '2026-10-26', '2026-12-26']);
  });

  it('31 は月末', () => {
    const end = { day_of_month: 31, interval_months: 1, start_date: '2026-09-01', holiday_shift: 'none' as const };
    expect(occurrencesBetween(end, null, '2026-11-30')).toEqual(['2026-09-30', '2026-10-31', '2026-11-30']);
  });
});

describe('nextOccurrence', () => {
  it('今日以降でいちばん近い回', () => {
    expect(nextOccurrence(monthly27, '2026-10-18')).toBe('2026-10-27');
    expect(nextOccurrence(monthly27, '2026-10-27')).toBe('2026-10-27');
    expect(nextOccurrence(monthly27, '2026-10-28')).toBe('2026-11-27');
  });
});
