import { assignNamedAccounts, type ImportDraft } from './extract';
import { matchNamedAccount } from './payment';

const a = (id: string, name: string, kind: 'bank' | 'emoney' | 'investment', is_reserved = false) => ({
  id,
  name,
  kind,
  is_archived: false,
  is_reserved,
});
const accounts = [
  a('bank', 'さくら銀行', 'bank'),
  a('pay', 'ペイA', 'emoney'),
  a('pay-plus', 'ペイAプラス', 'emoney'),
  a('point', 'ポイントB', 'emoney'),
  a('nisa', 'NISA', 'investment', true),
];

describe('matchNamedAccount', () => {
  it('書かれた名前に入っている口座（普段使わない口座も。長い名前を優先）', () => {
    expect(matchNamedAccount('ＮＩＳＡ口座へ入金', accounts)).toBe('nisa');
    expect(matchNamedAccount('ペイAプラス（チャージ）', accounts)).toBe('pay-plus');
    expect(matchNamedAccount('さくら銀行 普通預金', accounts)).toBe('bank');
  });

  it('違う口座が2つ以上・どれもなければ決めない', () => {
    expect(matchNamedAccount('ポイントBまたはペイA（チャージ）', accounts)).toBeNull();
    expect(matchNamedAccount('どこか', accounts)).toBeNull();
    expect(matchNamedAccount(null, accounts)).toBeNull();
  });
});

describe('assignNamedAccounts', () => {
  const draft = (patch: Partial<ImportDraft>): ImportDraft => ({
    key: '0',
    date: '2026-11-20',
    type: 'transfer',
    amount: 5500,
    payee: null,
    categoryId: null,
    fromAccountId: null,
    toAccountId: null,
    duplicate: false,
    source: 'other',
    payment: null,
    note: null,
    ...patch,
  });
  const match = (text: string | null | undefined) => matchNamedAccount(text, accounts);

  it('振替は書かれた出金元・入金先から、入金先は内容からも', () => {
    const [d] = assignNamedAccounts([draft({ fromName: 'さくら銀行', payee: 'ペイA（チャージ）' })], match);
    expect([d.fromAccountId, d.toAccountId]).toEqual(['bank', 'pay']);
  });

  it('AI が選んだ口座は変えない。収入は入金先だけ', () => {
    const [t] = assignNamedAccounts([draft({ fromAccountId: 'pay', fromName: 'さくら銀行', toName: 'NISA' })], match);
    expect([t.fromAccountId, t.toAccountId]).toEqual(['pay', 'nisa']);
    const [i] = assignNamedAccounts([draft({ type: 'income', fromName: 'さくら銀行', toName: 'ペイA' })], match);
    expect([i.fromAccountId, i.toAccountId]).toEqual([null, 'pay']);
  });

  it('同じ口座どうしの振替にはしない', () => {
    const [d] = assignNamedAccounts([draft({ fromName: 'さくら銀行', toName: 'さくら銀行' })], match);
    expect([d.fromAccountId, d.toAccountId]).toEqual(['bank', null]);
  });
});
