import { emptyRuleForm, toRuleRow, validateRuleForm } from './formValues';

const today = '2026-10-21';
const accounts = [{ id: 'bank', kind: 'bank' as const }];
const categories = [{ id: 'rent', kind: 'expense' as const }];

describe('validateRuleForm', () => {
  it('内容と日を確かめる', () => {
    const errors = validateRuleForm(
      { ...emptyRuleForm(today), amount: '1000', fromAccountId: 'bank', dayOfMonth: '32' },
      accounts,
      categories,
    );
    expect(errors).toMatchObject({ name: '内容を入力してください', dayOfMonth: '1〜31の数字で入力してください' });
  });
});

describe('toRuleRow', () => {
  it('その種類で使わない口座・カテゴリは空にする', () => {
    const row = toRuleRow({
      ...emptyRuleForm(today),
      name: ' 家賃 ',
      type: 'income',
      amount: '50000',
      fromAccountId: 'bank',
      toAccountId: 'bank',
      categoryId: 'rent',
      intervalMonths: '2',
    });
    expect(row).toMatchObject({ name: '家賃', from_account_id: null, to_account_id: 'bank', interval_months: 2 });
  });
});
