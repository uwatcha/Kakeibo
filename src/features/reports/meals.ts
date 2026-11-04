import type { Category } from '@/features/categories/api';
import { categoryPieces, type TransactionItem } from '@/features/transactions/items';
import { daysInclusive } from '@/lib/date';

/** 1日の食事の回数（2026-11-04 ユーザーの指定: 1日3食とみなす。間食は別に数える） */
export const MEALS_PER_DAY = 3;

/** 食費の小分類の名前（初期カテゴリ。利用者が名前を変えたら、その分は「食費」として数える） */
const FOOD = '食費';
const GROCERIES = '食料品';
const READY_MEAL = '中食';
const EATING_OUT = '外食';
const SNACK = '間食';

export type MealStats = {
  /** 数えた日数（期間の初めから、今日か期間の終わりまで） */
  days: number;
  /** 食事の数 = 日数 × 3 */
  meals: number;
  /** 食費（食料品・中食・外食。間食を除く食費） */
  mealTotal: number;
  /** 1食の平均 = 食費 ÷ 食事の数 */
  perMeal: number;
  snackTotal: number;
  /** 1日あたりの間食 */
  snackPerDay: number;
  /** 食料品（自炊の材料） */
  groceries: number;
  /** 外食・中食の記録の数（1件 = 1食とみなす） */
  boughtMeals: number;
  /** 自炊の食事の数 = 食事の数 − 外食・中食の記録の数 */
  homeMeals: number;
  /** 自炊の1食 = 食料品 ÷ 自炊の食事の数。自炊の食事がなければ null */
  homePerMeal: number | null;
  /** 外食（REQ-22） */
  eatingOut: {
    count: number;
    total: number;
    /** 自炊より多く使った額 = Σ（外食1回の額 − 自炊の1食）。自炊の1食が出せなければ null */
    overHome: number | null;
  };
};

type Expense = {
  type: string;
  amount: number;
  category_id: string | null;
  is_confirmed: boolean;
  items?: readonly TransactionItem[] | null;
};

/**
 * 食費のカード（REQ-23 1食の平均、REQ-22 外食と自炊の差。2026-11-04 ユーザーの指定）。
 * 支払い（確認済み）を内訳の品目ごとに、食費の小分類で分けて数える。1件の記録に外食・中食の品目があれば、その種類ごとに1食
 */
export function computeMealStats(
  transactions: readonly Expense[],
  categories: readonly Category[],
  from: string,
  through: string,
): MealStats {
  const food = categories.find((c) => c.kind === 'expense' && c.name === FOOD && !c.parent_id);
  const kindOf = (categoryId: string | null): string | null => {
    const category = categories.find((c) => c.id === categoryId);
    if (!food || !category) return null;
    if (category.id === food.id) return FOOD;
    return category.parent_id === food.id ? category.name : null;
  };

  let mealTotal = 0;
  let snackTotal = 0;
  let groceries = 0;
  let readyMeals = 0;
  const eatingOutVisits: number[] = [];
  for (const t of transactions) {
    if (t.type !== 'expense' || !t.is_confirmed) continue;
    let eatOut = 0;
    let ready = false;
    for (const piece of categoryPieces(t)) {
      const kind = kindOf(piece.categoryId);
      if (kind === null) continue;
      if (kind === SNACK) {
        snackTotal += piece.amount;
        continue;
      }
      mealTotal += piece.amount;
      if (kind === GROCERIES) groceries += piece.amount;
      if (kind === READY_MEAL) ready = true;
      if (kind === EATING_OUT) eatOut += piece.amount;
    }
    if (ready) readyMeals += 1;
    if (eatOut > 0) eatingOutVisits.push(eatOut);
  }

  const days = Math.max(1, daysInclusive(from, through));
  const meals = days * MEALS_PER_DAY;
  const boughtMeals = readyMeals + eatingOutVisits.length;
  const homeMeals = meals - boughtMeals;
  const homePerMeal = homeMeals > 0 ? Math.round(groceries / homeMeals) : null;
  return {
    days,
    meals,
    mealTotal,
    perMeal: Math.round(mealTotal / meals),
    snackTotal,
    snackPerDay: Math.round(snackTotal / days),
    groceries,
    boughtMeals,
    homeMeals,
    homePerMeal,
    eatingOut: {
      count: eatingOutVisits.length,
      total: eatingOutVisits.reduce((sum, v) => sum + v, 0),
      overHome: homePerMeal === null ? null : eatingOutVisits.reduce((sum, v) => sum + v - homePerMeal, 0),
    },
  };
}
