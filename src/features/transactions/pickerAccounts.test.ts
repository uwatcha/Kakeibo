import { pickerAccounts } from './pickerAccounts';

const acc = (
  id: string,
  kind: 'cash' | 'receivable' | 'payable',
  extra: Partial<{ is_archived: boolean; is_reserved: boolean }> = {},
) => ({
  id,
  kind,
  is_archived: false,
  is_reserved: false,
  ...extra,
});

const accounts = [
  acc('wallet', 'cash'),
  acc('kenta', 'receivable'),
  acc('sakura', 'receivable'),
  acc('old', 'receivable', { is_reserved: true }),
  acc('gone', 'receivable', { is_archived: true }),
];
const balances = new Map([
  ['wallet', 0],
  ['kenta', 9000],
  ['sakura', 0],
  ['old', 300],
]);
const ids = (r: { shown: { id: string }[] }) => r.shown.map((a) => a.id);

describe('pickerAccounts', () => {
  it('残高 0 円・普段使わない相手は隠す', () => {
    const r = pickerAccounts(accounts, ['receivable'], null, balances, false);
    expect(ids(r)).toEqual(['kenta']);
    expect(r.hiddenCount).toBe(2);
  });
  it('すべて表示なら出す（非表示の口座は出さない）', () => {
    expect(ids(pickerAccounts(accounts, ['receivable'], null, balances, true))).toEqual(['kenta', 'sakura', 'old']);
  });
  it('選んでいる口座は隠さない', () => {
    expect(ids(pickerAccounts(accounts, ['receivable'], 'sakura', balances, false))).toEqual(['kenta', 'sakura']);
    expect(ids(pickerAccounts(accounts, ['receivable'], 'gone', balances, false))).toEqual(['kenta', 'gone']);
  });
  it('相手でない口座は残高 0 でも隠さない', () => {
    expect(ids(pickerAccounts(accounts, ['cash'], null, balances, false))).toEqual(['wallet']);
  });
  it('残高がわからないときは残高では隠さない', () => {
    expect(ids(pickerAccounts(accounts, ['receivable'], null, undefined, false))).toEqual(['kenta', 'sakura']);
  });

  it('普段使わない口座は後ろに並べる', () => {
    const list = [acc('reserve', 'cash', { is_reserved: true }), acc('wallet', 'cash'), acc('bank', 'cash')];
    expect(ids(pickerAccounts(list, ['cash'], null, undefined, false))).toEqual(['wallet', 'bank', 'reserve']);
  });
});
