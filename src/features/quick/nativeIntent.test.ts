import { redirectSystemPath } from '@/app/+native-intent';

describe('外から開かれた URL の書き換え', () => {
  it('ウィジェットの URL は、アプリ本体では開かない（最初に開いたときはホーム）', () => {
    expect(redirectSystemPath({ path: 'kakeibo-quick://add', initial: false })).toBeNull();
    expect(redirectSystemPath({ path: 'kakeibo-quick://photo', initial: true })).toBe('/');
  });

  it('アプリ本体の URL はそのまま', () => {
    expect(redirectSystemPath({ path: 'kakeibo://transaction/new', initial: false })).toBe('kakeibo://transaction/new');
  });
});
