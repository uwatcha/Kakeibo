import type { Category } from '@/features/categories/api';

import { computeMealStats } from './meals';

const category = (id: string, name: string, parent_id: string | null = 'food') =>
  ({ id, name, kind: 'expense', parent_id, is_archived: false, sort_order: 0 }) as unknown as Category;
const categories = [
  category('food', '食費', null),
  category('groceries', '食料品'),
  category('ready', '中食'),
  category('out', '外食'),
  category('snack', '間食'),
  category('daily', '日用品', null),
];
const expense = (amount: number, category_id: string | null, extra: object = {}) => ({
  type: 'expense',
  amount,
  category_id,
  is_confirmed: true,
  ...extra,
});

describe('computeMealStats', () => {
  it('1食の平均・間食・自炊の1食・外食で自炊より多く使った額', () => {
    const stats = computeMealStats(
      [
        expense(3000, 'groceries'),
        expense(1000, 'out'),
        expense(600, 'out'),
        expense(300, 'snack'),
        // レシートの内訳: 食料品 800・中食 500・日用品 200（中食があるので1食）
        expense(1500, 'groceries', {
          items: [
            { category_id: 'groceries', name: null, amount: 800, is_adjustment: false },
            { category_id: 'ready', name: null, amount: 500, is_adjustment: false },
            { category_id: 'daily', name: null, amount: 200, is_adjustment: false },
          ],
        }),
        expense(9999, 'out', { is_confirmed: false }), // 未確認は数えない
        { type: 'income', amount: 500, category_id: null, is_confirmed: true },
      ],
      categories,
      '2026-10-25',
      '2026-10-26',
    );
    expect(stats).toMatchObject({
      days: 2,
      meals: 6,
      mealTotal: 5900, // 3000 + 1000 + 600 + 800 + 500
      perMeal: 983,
      snackPerDay: 150,
      groceries: 3800,
      boughtMeals: 3, // 外食2・中食1
      homeMeals: 3,
      homePerMeal: 1267,
      eatingOut: { count: 2, total: 1600, overHome: 1600 - 1267 * 2 },
    });
  });

  it('外食・中食で食事の数を超えたら、自炊の1食は出さない', () => {
    const stats = computeMealStats(
      [expense(500, 'out'), expense(500, 'out'), expense(500, 'out'), expense(500, 'out')],
      categories,
      '2026-10-25',
      '2026-10-25',
    );
    expect(stats.homePerMeal).toBeNull();
    expect(stats.eatingOut.overHome).toBeNull();
  });
});
