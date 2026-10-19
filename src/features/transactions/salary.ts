import type { Category } from '@/features/categories/api';

/** 収入元（働き先）を必須にする収入のカテゴリ（初期カテゴリの名前）。小分類はこの大分類の下ならすべて */
export const SALARY_CATEGORY = '給与・アルバイト';

/** そのカテゴリが「給与・アルバイト」（またはその小分類）か */
export function isSalaryCategory(categoryId: string | null, categories: readonly Category[]): boolean {
  const category = categories.find((c) => c.id === categoryId);
  if (!category || category.kind !== 'income') return false;
  const top = categories.find((c) => c.id === category.parent_id) ?? category;
  return top.name === SALARY_CATEGORY;
}
