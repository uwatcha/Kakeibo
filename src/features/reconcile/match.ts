/**
 * 明細の照らし合わせ（2026-11-24 改善要望: AI 相談に照らし合わせを任せたら、ある記録を「漏れ」と言ったり、ない記録を
 * 前提にしたりした）。明細の読み取りだけを AI に任せ、記録との照らし合わせはここで決まったとおりに行う
 */

/** 明細の1行（AI が読み取ったもの）。out = 口座からお金が出た、in = 入った */
export type StatementRow = {
  key: string;
  date: string;
  direction: 'out' | 'in';
  amount: number;
  description: string | null;
};

/** 照らし合わせる記録（その口座が関わるもの。向きはその口座から見たもの） */
export type ReconcileRecord = {
  id: string;
  date: string;
  direction: 'out' | 'in';
  amount: number;
  /** ポイントで一部を払った支払いの、本来の金額（明細にはこちらが載ることがある） */
  listPrice: number | null;
  payee: string | null;
  type: string;
  isConfirmed: boolean;
};

export type ReconcileResult = {
  /** 明細にも記録にもある */
  matched: { row: StatementRow; record: ReconcileRecord }[];
  /** 明細にあって記録にない */
  missing: StatementRow[];
  /** 記録にあって明細にない（明細の期間の中のものだけ） */
  extra: ReconcileRecord[];
};

/** 日付のずれをどこまで同じ取引とみなすか（銀行の明細は利用日と引き落とし日がずれる） */
export const DATE_TOLERANCE_DAYS = 3;

const dayDiff = (a: string, b: string) =>
  Math.abs(Date.parse(`${a}T00:00:00Z`) - Date.parse(`${b}T00:00:00Z`)) / 86_400_000;

const sameAmount = (row: StatementRow, record: ReconcileRecord) =>
  record.amount === row.amount || record.listPrice === row.amount;

/**
 * 明細の行と記録を1対1で結び付ける: 向きと金額が同じで、日付のずれが DATE_TOLERANCE_DAYS 日以内のもの。
 * 候補が複数あれば、日付の近い組から決める（同じ金額の取引が続いても、日付の順に結び付く）
 */
export function reconcile(rows: readonly StatementRow[], records: readonly ReconcileRecord[]): ReconcileResult {
  const pairs: { row: StatementRow; record: ReconcileRecord; diff: number; order: number }[] = [];
  rows.forEach((row, order) => {
    for (const record of records) {
      if (record.direction !== row.direction || !sameAmount(row, record)) continue;
      const diff = dayDiff(row.date, record.date);
      if (diff <= DATE_TOLERANCE_DAYS) pairs.push({ row, record, diff, order });
    }
  });
  pairs.sort((a, b) => a.diff - b.diff || a.order - b.order || a.record.date.localeCompare(b.record.date));
  const usedRows = new Set<string>();
  const usedRecords = new Set<string>();
  const matched: ReconcileResult['matched'] = [];
  for (const p of pairs) {
    if (usedRows.has(p.row.key) || usedRecords.has(p.record.id)) continue;
    usedRows.add(p.row.key);
    usedRecords.add(p.record.id);
    matched.push({ row: p.row, record: p.record });
  }
  const dates = rows.map((r) => r.date).sort();
  const [first, last] = [dates[0], dates[dates.length - 1]];
  return {
    matched: matched.sort((a, b) => a.row.date.localeCompare(b.row.date)),
    missing: rows.filter((r) => !usedRows.has(r.key)).sort((a, b) => a.date.localeCompare(b.date)),
    extra:
      rows.length === 0
        ? []
        : records
            .filter((r) => !usedRecords.has(r.id) && r.date >= first && r.date <= last)
            .sort((a, b) => a.date.localeCompare(b.date)),
  };
}

const DATE = /^\d{4}-\d{2}-\d{2}$/;

/** AI の返事（JSON の配列）を明細の行にする。形がおかしい行・0円以下の行は捨てる */
export function toStatementRows(records: unknown): StatementRow[] {
  if (!Array.isArray(records)) return [];
  const rows: StatementRow[] = [];
  records.forEach((r: Record<string, unknown>, i) => {
    if (typeof r !== 'object' || r === null) return;
    const amount = typeof r.amount === 'number' ? Math.round(r.amount) : Number.NaN;
    const date = typeof r.date === 'string' && DATE.test(r.date) ? r.date : null;
    const direction = r.direction === 'in' ? 'in' : r.direction === 'out' ? 'out' : null;
    if (!date || !direction || !Number.isFinite(amount) || amount <= 0) return;
    const description =
      typeof r.description === 'string' && r.description.trim() ? r.description.trim().slice(0, 100) : null;
    rows.push({ key: String(i), date, direction, amount, description });
  });
  return rows;
}

/** 明細を読み取る指示 */
export function statementPrompt(today: string, accountName: string): string {
  return [
    `あなたは家計簿の入力係です。添付は「${accountName}」の明細・取引履歴（通帳・ネットバンキング・決済アプリの画面、CSV など）です。`,
    `今日は ${today} です。年が書かれていない日付は、今日より後にならない一番近い年にしてください。`,
    '載っている取引を1行ずつ、漏らさず・足さずに取り出し、次の形の JSON の配列だけを返してください。取引がなければ []。',
    '[{"date":"YYYY-MM-DD","direction":"out|in","amount":整数の円,"description":"明細に書かれた内容"}]',
    '- out はこの口座からお金が出た取引（支払い・出金・引き落とし・振込・チャージした側）、in は入った取引（入金・受け取り・チャージされた側・返金）',
    '- amount は明細に書かれた取引の金額（正の整数）。残高の列の金額は使わない',
    '- 残高だけの行・合計の行・ポイントの付与（「付与処理中」など、お金が動かないもの）は入れない',
    '- 同じ画像が重なって写っている（スクロールした画面を何枚か撮った）ときは、同じ取引を2回入れない',
    '- 画像に写っていない取引を推測して足さない。読めない行は入れない',
    '- description は明細の文字をそのまま（店名・振込名義・「JD／○○」など）',
  ].join('\n');
}
