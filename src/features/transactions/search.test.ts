import { buildSearchFilter } from './search';

describe('buildSearchFilter', () => {
  it('内容とメモの部分一致', () => {
    expect(buildSearchFilter('ラーメン', [])).toBe('payee.ilike.*ラーメン*,memo.ilike.*ラーメン*');
  });

  it('数字なら金額の一致も探す（カンマ・全角も可）', () => {
    expect(buildSearchFilter('１，２００', [])).toContain('amount.eq.1200');
  });

  it('名前が一致したカテゴリも探す', () => {
    expect(buildSearchFilter('食費', ['c1', 'c2'])).toContain('category_id.in.(c1,c2)');
  });

  it('区切りに使われる記号は外す', () => {
    expect(buildSearchFilter('a,b)', [])).toBe('payee.ilike.*a b*,memo.ilike.*a b*');
  });

  it('空なら検索しない', () => {
    expect(buildSearchFilter('  ', [])).toBeNull();
    expect(buildSearchFilter(',()', [])).toBeNull();
  });
});
