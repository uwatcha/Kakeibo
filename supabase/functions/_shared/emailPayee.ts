// メールからの記録で、利用先から内容（店名）とカテゴリを決めるところのうち、DB や AI を呼ばない部分。
// Edge Function email-import とアプリのテスト（src/features/emailImport/payee.test.ts）から使う

import { type EmailKind, isDebitCardName } from './emailParse.ts';
import { DEFAULT_SUMMARY_RULES } from './emailRules.ts';

export type PayeeKind = 'expense' | 'income';
export type PayeeCategory = { id: string; name: string; kind: PayeeKind; parent_id: string | null; is_archived: boolean };
export type PayeeRule = { raw_payee: string; kind: PayeeKind; payee: string | null; category_id: string | null };
/** AI に決めてもらう利用先 */
export type PayeeQuestion = { raw: string; kind: PayeeKind };
/** AI の答え（1件）。known が false なら、どの店か分からなかった */
export type PayeeAnswer = { raw: string; payee: string; categoryId: string | null; known: boolean };

/** 「食費 / 外食」のように大分類から書く（AI に渡す・AI の答えを照らし合わせる名前） */
export function categoryPath(c: PayeeCategory, all: readonly PayeeCategory[]): string {
  const parent = all.find((p) => p.id === c.parent_id);
  return parent ? `${parent.name} / ${c.name}` : c.name;
}

/** 読み取った行のうち、利用先から内容を決める必要があり、まだ対応表にないもの（同じ利用先は1つにまとめる） */
export function payeeQuestions(
  rows: readonly { kind: EmailKind | null; raw_payee: string | null }[],
  known: ReadonlySet<string>,
): PayeeQuestion[] {
  const questions: PayeeQuestion[] = [];
  for (const r of rows) {
    // サンプルカードの速報は店名がなく、連携サービス の「サンプルデビット」は デビットカード のメールで店名が分かる
    if (!r.raw_payee || r.kind === 'card_quick' || (r.kind === 'bank_out' && isDebitCardName(r.raw_payee))) continue;
    if (known.has(r.raw_payee) || questions.some((q) => q.raw === r.raw_payee)) continue;
    questions.push({ raw: r.raw_payee, kind: r.kind === 'bank_in' ? 'income' : 'expense' });
  }
  return questions;
}

/** AI への指示。要約ルール（なければ初期値）・カテゴリの一覧・自分で直した対応表の例を入れる */
export function buildPayeePrompt(
  summaryRules: string | null | undefined,
  categories: readonly PayeeCategory[],
  rules: readonly PayeeRule[],
): string {
  const usable = categories.filter((c) => !c.is_archived);
  const names = (kind: PayeeKind) =>
    usable
      .filter((c) => c.kind === kind)
      .map((c) => categoryPath(c, categories))
      .join('、');
  // 覚えた書き方に合わせてもらう
  const examples = rules
    .filter((r) => r.payee)
    .slice(0, 40)
    .map((r) => {
      const c = categories.find((x) => x.id === r.category_id);
      return `- 「${r.raw_payee}」→ 内容「${r.payee}」${c ? `・カテゴリ「${categoryPath(c, categories)}」` : ''}`;
    });
  return [
    'あなたは家計簿の入力係です。カードの利用通知・銀行の入出金のメールに書かれた「利用先」から、家計簿の「内容」（短い店名など）と「カテゴリ」を決めてください。',
    '# 内容の書き方のルール',
    summaryRules?.trim() || DEFAULT_SUMMARY_RULES,
    '# 支出のカテゴリ（kind が expense のとき、この中から1つ。合わなければ null）',
    names('expense'),
    '# 収入のカテゴリ（kind が income のとき、この中から1つ。合わなければ null）',
    names('income'),
    ...(examples.length > 0 ? ['# これまでの例（この書き方に合わせる）', ...examples] : []),
    '# 返し方',
    '次の形の JSON の配列だけを返す。入力と同じ順・同じ件数で、raw は入力のまま。',
    '[{"raw":"入力の利用先","payee":"内容","category":"カテゴリの名前かnull","known":true}]',
    'どの店・どの相手か分からないときは known を false にする',
  ].join('\n');
}

/**
 * AI の返事（JSON の文）を、質問ごとの答えにする。raw で照らし合わせ、なければ同じ順番のもの。
 * カテゴリは名前から id に戻し（種類が違う・一覧にないものは null）、内容がなければ利用先のまま
 */
export function readPayeeAnswers(
  text: string,
  questions: readonly PayeeQuestion[],
  categories: readonly PayeeCategory[],
): PayeeAnswer[] {
  let results: { raw?: unknown; payee?: unknown; category?: unknown; known?: unknown }[] = [];
  try {
    const parsed = JSON.parse(text);
    results = Array.isArray(parsed) ? parsed : [];
  } catch {
    results = [];
  }
  const usable = categories.filter((c) => !c.is_archived);
  return questions.map((q, index) => {
    const r = results.find((x) => x?.raw === q.raw) ?? results[index];
    const category =
      usable.find((c) => c.kind === q.kind && categoryPath(c, categories) === r?.category) ?? null;
    const payee = (typeof r?.payee === 'string' ? r.payee : '').normalize('NFKC').trim().slice(0, 60) || q.raw;
    return { raw: q.raw, payee, categoryId: category?.id ?? null, known: r?.known === true };
  });
}

/** YYYY-MM-DD に日数を足す */
export function addDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
