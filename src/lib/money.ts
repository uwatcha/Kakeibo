const yenFormatter = new Intl.NumberFormat('ja-JP');

/** 数字と幅がそろうマイナス記号（ハイフンではなく U+2212） */
export const MINUS = '\u2212';

/** 円の整数を「1,234円」の形にする。負の値は「−1,234円」 */
export function formatYen(amount: number): string {
  return `${amount < 0 ? MINUS : ''}${yenFormatter.format(Math.abs(amount))}円`;
}

/** 増減用。0 以外は必ず符号を付ける（「+1,234円」「−1,234円」） */
export function formatSignedYen(amount: number): string {
  return `${amount > 0 ? '+' : ''}${formatYen(amount)}`;
}

/** 入力文字列（全角数字・カンマ可）を円の正の整数にする。不正なら null */
export function parseYen(input: string): number | null {
  const normalized = input
    .replace(/[０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0))
    .replace(/[,，\s円]/g, '');
  if (!/^\d+$/.test(normalized)) return null;
  const value = Number(normalized);
  return Number.isSafeInteger(value) && value > 0 ? value : null;
}

/** 初期残高などの入力用。空欄は 0、0 以上の整数を返す。不正なら null */
export function parseNonNegativeYen(input: string): number | null {
  const trimmed = input.trim();
  if (trimmed === '') return 0;
  if (/^[0０]+$/.test(trimmed)) return 0;
  return parseYen(trimmed);
}
