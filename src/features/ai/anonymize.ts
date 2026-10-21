import { ACCOUNT_KIND_INFO, type AccountKind } from '@/features/accounts/accountKinds';
import type { Category } from '@/features/categories/api';
import { categoryLabel } from '@/features/categories/tree';
import { paydayLabel } from '@/features/employers/labels';
import type { PaydayRule } from '@/features/employers/payday';
import { scheduleLabel } from '@/features/recurring/labels';
import { TRANSACTION_RULES, type TransactionType } from '@/features/transactions/transactionRules';
import { formatYen } from '@/lib/money';

/**
 * AI（Gemini）に渡す材料を作る。個人情報になりうる名前は、送る前に置き換える
 * - 口座の名前 → 「銀行A」「クレジットカードA」、貸し借りの相手 → 「相手A」
 * - 働き先 → 「勤務先A」
 * - 記録の内容・定期支払いの名前 → 「内容1」
 * - メモ → 中身は送らず「メモあり」だけ
 * AI の返事に出てきた置き換え後の名前は、画面に出す前に restoreText で元に戻す
 */

type AccountLike = { id: string; name: string; kind: AccountKind; balance: number; includeInAvailable: boolean };
type EmployerLike = PaydayRule & { id: string; name: string; is_archived: boolean };
type TransactionLike = {
  date: string;
  type: TransactionType;
  amount: number;
  from_account_id: string | null;
  to_account_id: string | null;
  category_id: string | null;
  payee: string | null;
  memo: string | null;
  employer_id: string | null;
  is_confirmed: boolean;
};
type RuleLike = {
  name: string;
  type: TransactionType;
  amount: number;
  from_account_id: string | null;
  to_account_id: string | null;
  category_id: string | null;
  day_of_month: number;
  interval_months: number;
  is_active: boolean;
};

export type AiSource = {
  today: string;
  accounts: readonly AccountLike[];
  categories: readonly Category[];
  employers: readonly EmployerLike[];
  transactions: readonly TransactionLike[];
  rules: readonly RuleLike[];
};

export type Aliases = {
  /** 置き換え後 → 元の名前 */
  toReal: Map<string, string>;
  /** 元の名前 → 置き換え後（自分で打った質問の中の名前を置き換えるのに使う） */
  toAlias: Map<string, string>;
  account: (id: string | null) => string;
  employer: (id: string | null) => string;
  payee: (name: string | null) => string;
};

const KIND_ALIAS: Record<AccountKind, string> = {
  cash: '現金',
  bank: '銀行',
  emoney: '電子マネー',
  investment: '投資',
  credit_card: 'クレジットカード',
  receivable: '相手',
  payable: '相手',
};

/** 0 → A、25 → Z、26 → AA */
function letters(index: number): string {
  let n = index;
  let out = '';
  do {
    out = String.fromCharCode(65 + (n % 26)) + out;
    n = Math.floor(n / 26) - 1;
  } while (n >= 0);
  return out;
}

export function buildAliases(source: AiSource): Aliases {
  const toReal = new Map<string, string>();
  const toAlias = new Map<string, string>();
  const remember = (real: string, alias: string) => {
    toReal.set(alias, real);
    if (!toAlias.has(real)) toAlias.set(real, alias);
  };

  const accountAlias = new Map<string, string>();
  const counts = new Map<string, number>();
  for (const a of source.accounts) {
    const prefix = KIND_ALIAS[a.kind];
    const n = counts.get(prefix) ?? 0;
    counts.set(prefix, n + 1);
    const alias = `${prefix}${letters(n)}`;
    accountAlias.set(a.id, alias);
    remember(a.name, alias);
  }

  const employerAlias = new Map<string, string>();
  source.employers.forEach((e, i) => {
    const alias = `勤務先${letters(i)}`;
    employerAlias.set(e.id, alias);
    remember(e.name, alias);
  });

  const payeeAlias = new Map<string, string>();
  const payees = [...source.transactions.map((t) => t.payee), ...source.rules.map((r) => r.name)];
  for (const payee of payees) {
    if (!payee || payeeAlias.has(payee)) continue;
    const alias = `内容${payeeAlias.size + 1}`;
    payeeAlias.set(payee, alias);
    remember(payee, alias);
  }

  return {
    toReal,
    toAlias,
    account: (id) => (id ? (accountAlias.get(id) ?? '不明な口座') : ''),
    employer: (id) => (id ? (employerAlias.get(id) ?? '') : ''),
    payee: (name) => (name ? (payeeAlias.get(name) ?? '') : ''),
  };
}

/** 長いものから置き換える（「内容1」より先に「内容12」を置き換えるなど） */
function replaceAll(text: string, map: ReadonlyMap<string, string>): string {
  const keys = [...map.keys()].filter((k) => k.length > 0).sort((a, b) => b.length - a.length);
  if (keys.length === 0) return text;
  const escaped = keys.map((k) => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  return text.replace(new RegExp(escaped.join('|'), 'g'), (match) => map.get(match) ?? match);
}

/** 自分で打った文の中の名前を、置き換え後の名前にする（「父」のような1文字の名前も、送らないことを優先して置き換える） */
export function maskText(text: string, aliases: Aliases): string {
  return replaceAll(text, aliases.toAlias);
}

/** AI の返事の中の置き換え後の名前を、元の名前に戻す */
export function restoreText(text: string, aliases: Aliases): string {
  return replaceAll(text, aliases.toReal);
}

/** AI に渡す家計の材料（置き換え済み） */
export function buildContext(source: AiSource, aliases: Aliases): string {
  const lines: string[] = [`今日: ${source.today}`, ''];

  lines.push('## 口座（残高は今日までの記録で計算。クレジットカードと借りている相手はマイナス）');
  for (const a of source.accounts) {
    const flags = [ACCOUNT_KIND_INFO[a.kind].label, a.includeInAvailable ? '実質残高に含む' : '実質残高に含まない'];
    lines.push(`- ${aliases.account(a.id)}（${flags.join('・')}）: ${formatYen(a.balance)}`);
  }

  const employers = source.employers.filter((e) => !e.is_archived);
  if (employers.length > 0) {
    lines.push('', '## 勤務先（給料日）');
    for (const e of employers) lines.push(`- ${aliases.employer(e.id)}: ${paydayLabel(e)}`);
  }

  const rules = source.rules.filter((r) => r.is_active);
  if (rules.length > 0) {
    lines.push('', '## 定期支払い（毎回自動で記録に入るもの）');
    for (const r of rules) {
      const where = [aliases.account(r.from_account_id), aliases.account(r.to_account_id)].filter(Boolean).join(' → ');
      const category = categoryLabel(r.category_id, source.categories);
      lines.push(
        `- ${aliases.payee(r.name)}: ${scheduleLabel(r)} ${formatYen(r.amount)} ${TRANSACTION_RULES[r.type].label} ${where}${category ? ` / ${category}` : ''}`,
      );
    }
  }

  lines.push(
    '',
    '## 記録（直近3か月とこれからの予定。日付 | 種類 | 金額 | 出金元 → 入金先 | カテゴリ | 内容 | 補足）',
    '支払い・収入だけが収支に入る。振替・立て替え・貸し借り・残高調整は自分のお金の置き場所が変わるだけ',
  );
  for (const t of source.transactions) {
    const notes = [
      t.date > source.today ? '予定' : !t.is_confirmed ? '未確認' : null,
      t.employer_id ? `収入元 ${aliases.employer(t.employer_id)}` : null,
      t.memo ? 'メモあり' : null,
    ].filter(Boolean);
    lines.push(
      [
        t.date,
        TRANSACTION_RULES[t.type].label,
        formatYen(t.amount),
        `${aliases.account(t.from_account_id) || '-'} → ${aliases.account(t.to_account_id) || '-'}`,
        categoryLabel(t.category_id, source.categories) ?? '-',
        aliases.payee(t.payee) || '-',
        notes.join('・') || '-',
      ].join(' | '),
    );
  }
  return lines.join('\n');
}

export const SYSTEM_PROMPT = `あなたは個人の家計の相談相手です。ユーザーの家計簿アプリのデータ（下の「家計の材料」）をもとに、日本語で、具体的な数字を挙げて答えてください。
- 金額は「12,300円」のように書く
- プライバシーのため、口座・相手・勤務先・記録の内容の名前は「銀行A」「相手A」「勤務先A」「内容1」のように置き換えてある。答えでもその名前のまま書く（推測して本当の名前を書かない）
- データから分からないことは、分からないと言う。断定しすぎない
- 答えは短めに。Markdown（見出し・太字・箇条書き・表）で読みやすく整える`;
