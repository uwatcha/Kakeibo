import { isConfirmedOnSave, needsAccount, recordStatus } from './confirmation';

const today = '2026-10-20';

describe('recordStatus', () => {
  it('未来の日付は確認の有無にかかわらず予定', () => {
    expect(recordStatus({ date: '2026-10-21', is_confirmed: false }, today)).toBe('planned');
    expect(recordStatus({ date: '2026-10-21', is_confirmed: true }, today)).toBe('planned');
  });
  it('当日を迎えて確認していなければ未確認', () => {
    expect(recordStatus({ date: today, is_confirmed: false }, today)).toBe('unconfirmed');
    expect(recordStatus({ date: '2026-10-01', is_confirmed: false }, today)).toBe('unconfirmed');
  });
  it('確認済み', () => {
    expect(recordStatus({ date: today, is_confirmed: true }, today)).toBe('confirmed');
  });
});

describe('isConfirmedOnSave', () => {
  it('今日以前は確認済み、未来は未確認', () => {
    expect(isConfirmedOnSave(today, today)).toBe(true);
    expect(isConfirmedOnSave('2026-10-19', today)).toBe(true);
    expect(isConfirmedOnSave('2026-10-21', today)).toBe(false);
  });
});

describe('needsAccount', () => {
  it('種類ごとに要る口座が空なら true', () => {
    expect(needsAccount({ type: 'expense', from_account_id: null, to_account_id: null })).toBe(true);
    expect(needsAccount({ type: 'expense', from_account_id: 'a', to_account_id: null })).toBe(false);
    expect(needsAccount({ type: 'income', from_account_id: null, to_account_id: null })).toBe(true);
    expect(needsAccount({ type: 'transfer', from_account_id: 'a', to_account_id: null })).toBe(true);
    expect(needsAccount({ type: 'adjustment', from_account_id: null, to_account_id: 'a' })).toBe(false);
  });
});
