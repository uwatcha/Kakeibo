import type { Category } from './api';
import { categoryIcon } from './icons';

const base = { user_id: 'u', kind: 'expense', sort_order: 0, is_archived: false, created_at: '' } as const;
const categories = [
  { ...base, id: 'food', parent_id: null, name: '食費' },
  { ...base, id: 'eatout', parent_id: 'food', name: '外食' },
  { ...base, id: 'custom', parent_id: null, name: 'ペット' },
] as Category[];

describe('categoryIcon', () => {
  it('大分類の名前からアイコンを選ぶ', () => {
    expect(categoryIcon('food', categories, 'cart')).toBe('silverware-fork-knife');
  });
  it('小分類は大分類のアイコン', () => {
    expect(categoryIcon('eatout', categories, 'cart')).toBe('silverware-fork-knife');
  });
  it('知らない名前・未分類は fallback', () => {
    expect(categoryIcon('custom', categories, 'cart')).toBe('cart');
    expect(categoryIcon(null, categories, 'cart')).toBe('cart');
  });
});
