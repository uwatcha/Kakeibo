import type { Category } from '@/features/categories/api';

import { buildBreakdown, compare, toDonutSlices } from './breakdown';

const category = (id: string, name: string): Category => ({
  id,
  name,
  kind: 'expense',
  parent_id: null,
  sort_order: 0,
  is_archived: false,
  user_id: 'u',
  created_at: '',
});
const categories = [category('food', '食費'), category('daily', '日用品'), category('fun', '趣味・娯楽')];

describe('buildBreakdown', () => {
  it('多い順に並べ、割合を出す。未分類も残す', () => {
    const items = buildBreakdown(
      [
        { category_id: 'daily', amount: 1000 },
        { category_id: 'food', amount: 3000 },
        { category_id: null, amount: 1000 },
      ],
      categories,
    );
    expect(items.map((i) => [i.name, i.amount, i.ratio])).toEqual([
      ['食費', 3000, 0.6],
      ['日用品', 1000, 0.2],
      ['未分類', 1000, 0.2],
    ]);
  });

  it('支出がなければ空', () => {
    expect(buildBreakdown([], categories)).toEqual([]);
  });
});

describe('toDonutSlices', () => {
  const items = Array.from({ length: 8 }, (_, i) => ({
    categoryId: `c${i}`,
    name: `カテゴリ${i}`,
    amount: 100 - i,
    ratio: 0.1,
  }));

  it('上位5件＋その他にまとめる', () => {
    const slices = toDonutSlices(items);
    expect(slices).toHaveLength(6);
    expect(slices[5]).toMatchObject({ key: 'other', name: 'その他（3）', amount: 95 + 94 + 93, isOther: true });
  });

  it('5件以下ならまとめない', () => {
    expect(toDonutSlices(items.slice(0, 4)).some((s) => s.isOther)).toBe(false);
  });
});

describe('compare', () => {
  it('前月との差と増減率', () => {
    expect(compare(12000, 10000)).toEqual({ current: 12000, previous: 10000, diff: 2000, rate: 0.2 });
  });

  it('前月が 0 なら増減率は出さない', () => {
    expect(compare(5000, 0).rate).toBeNull();
  });
});
