import { AiError } from '@/features/ai/api';

import { loadPhotoQueue, processPhotoQueue, queuePhoto } from './queue';

const mockStore = new Map<string, string>();
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: async (k: string) => mockStore.get(k) ?? null,
  setItem: async (k: string, v: string) => void mockStore.set(k, v),
}));
const mockRecord = jest.fn();
jest.mock('./scan', () => ({
  loadPhotoContext: async () => ({}),
  recordPhoto: (...args: unknown[]) => mockRecord(...args),
}));
jest.mock('@/lib/supabase', () => ({ supabase: {} }));

const photo = (key: string) => ({ key, data: 'x', takenAt: 1 });
const recorded = { recorded: 1, duplicates: 0, first: { status: 'recorded', payee: null, amount: 100 } };

describe('ウィジェットの写真の読み取り待ち', () => {
  beforeEach(() => {
    mockStore.clear();
    mockRecord.mockReset();
  });

  it('同時に呼んでも、同じ写真を2回記録しない', async () => {
    mockRecord.mockResolvedValue(recorded);
    await queuePhoto(photo('a'));
    await Promise.all([processPhotoQueue(), processPhotoQueue()]);
    expect(mockRecord).toHaveBeenCalledTimes(1);
    expect(await loadPhotoQueue()).toEqual([]);
  });

  it('読んでいる間に撮った写真も消さずに読む', async () => {
    mockRecord.mockImplementation(async (_c, _d, key: string) => {
      if (key === 'a') await queuePhoto(photo('b'));
      return recorded;
    });
    await queuePhoto(photo('a'));
    await processPhotoQueue();
    expect(mockRecord.mock.calls.map((c) => c[2])).toEqual(['a', 'b']);
  });

  it('混み合いならそこで止めて残し、最初の1回だけ知らせる。記録できる内容がなければ知らせる', async () => {
    mockRecord.mockResolvedValueOnce({ recorded: 0, duplicates: 0, first: null });
    mockRecord.mockRejectedValue(new AiError('混み合っています', true));
    await queuePhoto(photo('a'));
    await queuePhoto(photo('b'));
    expect(await processPhotoQueue()).toEqual([
      { key: 'a', kind: 'empty' },
      { key: 'b', kind: 'waiting', message: '混み合っています' },
    ]);
    expect((await loadPhotoQueue()).map((q) => q.key)).toEqual(['b']);
    // 2回目の確認でも混み合っていれば、もう知らせない
    expect(await processPhotoQueue()).toEqual([]);
  });

  it('AI に断られたら理由を知らせて捨てる。通信・保存の失敗は残して読み直し、5回で諦める', async () => {
    mockRecord.mockRejectedValueOnce(new AiError('キーが使えません', false));
    await queuePhoto(photo('a'));
    expect(await processPhotoQueue()).toEqual([{ key: 'a', kind: 'failed', message: 'キーが使えません' }]);
    expect(await loadPhotoQueue()).toEqual([]);

    mockRecord.mockRejectedValue(new Error('Network request failed'));
    await queuePhoto(photo('b'));
    const first = await processPhotoQueue();
    expect(first).toEqual([{ key: 'b', kind: 'waiting', message: expect.stringContaining('Network request failed') }]);
    for (let i = 0; i < 3; i++) expect(await processPhotoQueue()).toEqual([]);
    expect(await processPhotoQueue()).toEqual([{ key: 'b', kind: 'failed', message: expect.stringContaining('5回') }]);
    expect(await loadPhotoQueue()).toEqual([]);
  });
});
