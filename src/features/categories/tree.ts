import type { Category } from './api';

/** 「食費 / 外食」のように大分類から表示する */
export function categoryLabel(categoryId: string | null, categories: readonly Category[]): string | null {
  const category = categories.find((c) => c.id === categoryId);
  if (!category) return null;
  const parent = categories.find((c) => c.id === category.parent_id);
  return parent ? `${parent.name} / ${category.name}` : category.name;
}
