import { guessCategory } from './categoryGuess';

describe('guessCategory', () => {
  it('いちばん多いカテゴリ', () => {
    expect(guessCategory([{ category_id: 'a' }, { category_id: 'b' }, { category_id: 'b' }])).toBe('b');
  });

  it('同数なら新しい方（先頭側）', () => {
    expect(guessCategory([{ category_id: 'a' }, { category_id: 'b' }])).toBe('a');
  });

  it('カテゴリのない記録は数えない', () => {
    expect(guessCategory([{ category_id: null }, { category_id: null }, { category_id: 'c' }])).toBe('c');
    expect(guessCategory([{ category_id: null }])).toBeNull();
    expect(guessCategory([])).toBeNull();
  });
});
