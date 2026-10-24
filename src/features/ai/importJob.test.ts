import { clearImportJob, loadImportJob, saveImportJob } from './importJob';

// 端末のファイルの代わり（1つだけ持てる）
const mockStore: { content: string | null } = { content: null };
jest.mock('expo-file-system', () => ({
  Paths: { document: 'doc' },
  File: class {
    get exists() {
      return mockStore.content !== null;
    }
    create() {
      mockStore.content = '';
    }
    write(text: string) {
      mockStore.content = text;
    }
    async text() {
      return mockStore.content ?? '';
    }
    delete() {
      mockStore.content = null;
    }
  },
}));

const job = { today: '2026-10-24', texts: 'メモ', binaries: [{ mimeType: 'image/jpeg', data: 'abc' }], savedAt: 1000 };

describe('AI入力の途中の状態', () => {
  beforeEach(() => {
    mockStore.content = null;
  });

  it('置いたものを読み戻せ、消すとなくなる', async () => {
    saveImportJob(job);
    expect(await loadImportJob(2000)).toEqual(job);
    clearImportJob();
    expect(await loadImportJob(2000)).toBeNull();
  });

  it('3日より古いものは捨てる', async () => {
    saveImportJob(job);
    expect(await loadImportJob(1000 + 3 * 24 * 60 * 60 * 1000 + 1)).toBeNull();
    expect(mockStore.content).toBeNull();
  });

  it('壊れた中身なら null', async () => {
    mockStore.content = '{';
    expect(await loadImportJob(2000)).toBeNull();
  });
});
