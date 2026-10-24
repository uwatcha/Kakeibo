import { reminderDate } from './claudeKeyReminder';

jest.mock('@/features/background/backgroundTask', () => ({ NOTIFICATION_CHANNEL: 'x', prepareNotifications: jest.fn() }));

describe('Claude のキーの期限の通知', () => {
  it('期限の3日前の朝9時（日本時間）に知らせる', () => {
    // 期限: 日本時間 11/23 18:00
    const at = reminderDate('2026-11-23T09:00:00Z', Date.parse('2026-10-24T00:00:00Z'));
    expect(at?.toISOString()).toBe('2026-11-20T00:00:00.000Z');
  });

  it('日本時間で日付が変わる時刻でも、日本時間の日付で数える', () => {
    // 期限: 日本時間 11/24 02:00（UTC では 11/23）→ 日本時間 11/21 の 9時
    expect(reminderDate('2026-11-23T17:00:00Z', 0)?.toISOString()).toBe('2026-11-21T00:00:00.000Z');
  });

  it('知らせる時刻を過ぎていたら null', () => {
    expect(reminderDate('2026-11-23T09:00:00Z', Date.parse('2026-11-21T00:00:00Z'))).toBeNull();
  });
});
