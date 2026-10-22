import {
  addDays,
  buildPayeePrompt,
  categoryPath,
  type PayeeCategory,
  payeeQuestions,
  readPayeeAnswers,
} from '../../../supabase/functions/_shared/emailPayee';

const c = (id: string, name: string, kind: 'expense' | 'income', parent_id: string | null = null): PayeeCategory => ({
  id,
  name,
  kind,
  parent_id,
  is_archived: false,
});
const categories = [
  c('food', '食費', 'expense'),
  c('eatout', '外食', 'expense', 'food'),
  c('transport', '交通', 'expense'),
  c('gift', '仕送り', 'income'),
];

describe('payeeQuestions', () => {
  it('対応表にない利用先だけを、1つずつ、収入か支出かを付けて聞く', () => {
    const rows = [
      { kind: 'debit_mail' as const, raw_payee: 'ソバヤ' },
      { kind: 'card_detail' as const, raw_payee: 'ソバヤ' },
      { kind: 'bank_in' as const, raw_payee: 'ヤマダ タロウ' },
      { kind: 'bank_out' as const, raw_payee: 'サンプルデビット' },
      { kind: 'card_quick' as const, raw_payee: null },
      { kind: 'debit_mail' as const, raw_payee: 'セブンイレブン' },
    ];
    expect(payeeQuestions(rows, new Set(['セブンイレブン']))).toEqual([
      { raw: 'ソバヤ', kind: 'expense' },
      { raw: 'ヤマダ タロウ', kind: 'income' },
    ]);
  });
});

describe('buildPayeePrompt', () => {
  it('要約ルール（なければ初期値）・カテゴリ・自分で直した例を入れる', () => {
    const prompt = buildPayeePrompt(null, categories, [
      { raw_payee: 'ソバヤ', kind: 'expense', payee: 'そば屋', category_id: 'eatout' },
    ]);
    expect(prompt).toContain('半角カタカナは使わない');
    expect(prompt).toContain('食費、食費 / 外食、交通');
    expect(prompt).toContain('「ソバヤ」→ 内容「そば屋」・カテゴリ「食費 / 外食」');
    expect(buildPayeePrompt('- 自分のルール', categories, [])).toContain('- 自分のルール');
  });
});

describe('readPayeeAnswers', () => {
  const questions = [
    { raw: 'ソバヤ', kind: 'expense' as const },
    { raw: 'ヤマダ タロウ', kind: 'income' as const },
  ];

  it('raw で照らし合わせ、カテゴリの名前を id に戻す', () => {
    const answers = readPayeeAnswers(
      JSON.stringify([
        { raw: 'ヤマダ タロウ', payee: 'ヤマダ タロウ', category: '仕送り', known: true },
        { raw: 'ソバヤ', payee: 'そば屋', category: '食費 / 外食', known: true },
      ]),
      questions,
      categories,
    );
    expect(answers).toEqual([
      { raw: 'ソバヤ', payee: 'そば屋', categoryId: 'eatout', known: true },
      { raw: 'ヤマダ タロウ', payee: 'ヤマダ タロウ', categoryId: 'gift', known: true },
    ]);
  });

  it('種類の違うカテゴリは使わず、壊れた返事は分からないものにする', () => {
    const [wrongKind] = readPayeeAnswers(
      JSON.stringify([{ raw: 'ソバヤ', payee: 'ｿﾊﾞﾔ', category: '仕送り', known: true }]),
      questions.slice(0, 1),
      categories,
    );
    expect(wrongKind).toEqual({ raw: 'ソバヤ', payee: 'ソバヤ', categoryId: null, known: true });
    expect(readPayeeAnswers('壊れた', questions, categories).map((a) => a.known)).toEqual([false, false]);
  });
});

describe('categoryPath / addDays', () => {
  it('大分類から書く・月をまたいで日数を足す', () => {
    expect(categoryPath(categories[1], categories)).toBe('食費 / 外食');
    expect(addDays('2026-10-30', 3)).toBe('2026-11-02');
  });
});
