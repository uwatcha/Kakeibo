const yenFormatter = new Intl.NumberFormat('ja-JP');

/** 円の整数を「1,234円」の形にする。負の値は「-1,234円」 */
export function formatYen(amount: number): string {
  return `${yenFormatter.format(amount)}円`;
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
