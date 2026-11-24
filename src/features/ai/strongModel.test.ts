import { needsStrongModel } from './strongModel';

describe('needsStrongModel', () => {
  it('画像付き・照らし合わせなどの言葉・長い質問は強いモデル', () => {
    expect(needsStrongModel('これは何？', 1)).toBe(true);
    expect(needsStrongModel('通帳と記録を照らし合わせて', 0)).toBe(true);
    expect(needsStrongModel('残高がズレている原因は？', 0)).toBe(true);
    expect(needsStrongModel('あ'.repeat(300), 0)).toBe(true);
  });

  it('ふつうの質問は今のモデル', () => {
    expect(needsStrongModel('今月の食費はいくら？', 0)).toBe(false);
  });
});
