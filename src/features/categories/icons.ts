import type { Category } from './api';

/** 大分類の名前ごとのアイコン（初期カテゴリの名前）。名前を変えた・足した大分類は fallback になる */
const ICONS_BY_NAME: Record<string, string> = {
  食費: 'silverware-fork-knife',
  日用品: 'basket',
  交通: 'train',
  住居: 'home',
  ライフライン: 'lightning-bolt',
  '趣味・娯楽': 'gamepad-variant',
  交際: 'glass-cocktail',
  '衣服・美容': 'tshirt-crew',
  医療: 'medical-bag',
  学び: 'school',
  特別な出費: 'star',
  その他: 'dots-horizontal',
  仕送り: 'email',
  '給与・アルバイト': 'briefcase',
};

/** カテゴリのアイコン。小分類は大分類のアイコンを使う */
export function categoryIcon(categoryId: string | null, categories: readonly Category[], fallback: string): string {
  const category = categories.find((c) => c.id === categoryId);
  if (!category) return fallback;
  const top = categories.find((c) => c.id === category.parent_id) ?? category;
  return ICONS_BY_NAME[top.name] ?? fallback;
}
