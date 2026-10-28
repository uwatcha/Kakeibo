import { buildSearchFilter, EMPTY_FILTERS, expandCategoryIds, hasFilters, sourceFilter } from './search';

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

describe('項目ごとの絞り込み', () => {
  it('大分類を選ぶと小分類も含める', () => {
    const categories = [
      { id: 'food', parent_id: null },
      { id: 'eatout', parent_id: 'food' },
      { id: 'daily', parent_id: null },
    ];
    expect(expandCategoryIds(['food'], categories).sort()).toEqual(['eatout', 'food']);
    expect(expandCategoryIds(['eatout'], categories)).toEqual(['eatout']);
  });

  it('入力元は、手入力を auto_source なしとして or でつなぐ', () => {
    expect(sourceFilter([])).toBeNull();
    expect(sourceFilter(['manual', 'photo'])).toBe('auto_source.is.null,auto_source.eq.photo');
  });

  it('何か選んでいれば絞り込む', () => {
    expect(hasFilters(EMPTY_FILTERS)).toBe(false);
    expect(hasFilters({ ...EMPTY_FILTERS, amountMin: 0 })).toBe(true);
    expect(hasFilters({ ...EMPTY_FILTERS, types: ['expense'] })).toBe(true);
  });
});
