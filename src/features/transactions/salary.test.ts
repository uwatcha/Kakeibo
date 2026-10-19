import type { Category } from '@/features/categories/api';

import { isSalaryCategory } from './salary';

const base = { user_id: 'u', sort_order: 0, is_archived: false, created_at: '' } as const;
const categories = [
  { ...base, id: 'salary', parent_id: null, kind: 'income', name: '給与・アルバイト' },
  { ...base, id: 'bonus', parent_id: 'salary', kind: 'income', name: 'ボーナス' },
  { ...base, id: 'gift', parent_id: null, kind: 'income', name: '仕送り' },
] as Category[];

describe('isSalaryCategory', () => {
  it('給与・アルバイトとその小分類', () => {
    expect(isSalaryCategory('salary', categories)).toBe(true);
    expect(isSalaryCategory('bonus', categories)).toBe(true);
  });
  it('ほかのカテゴリ・未分類は対象外', () => {
    expect(isSalaryCategory('gift', categories)).toBe(false);
    expect(isSalaryCategory(null, categories)).toBe(false);
  });
});
