import { categoryGuideLines } from './categoryGuide';

describe('カテゴリの判断基準', () => {
  it('利用者のカテゴリにあるものだけ、小分類の名前で引いて渡す', () => {
    const lines = categoryGuideLines(['食費', '食費 / 中食', '食費 / 食料品', '交通']);
    expect(lines[0]).toContain('カテゴリの判断基準');
    expect(lines).toHaveLength(3);
    // 冷凍食品・パン・納豆・麺は食料品、弁当・惣菜は中食
    expect(lines.find((l) => l.startsWith('- 食費 / 食料品'))).toMatch(/冷凍食品.*/);
    expect(lines.find((l) => l.startsWith('- 食費 / 中食'))).toMatch(/惣菜/);
  });

  it('当てはまるカテゴリがなければ何も渡さない', () => {
    expect(categoryGuideLines(['交通', '住居'])).toEqual([]);
  });
});
