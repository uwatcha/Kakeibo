import type { ImportDraft } from '@/features/ai/extract';

/** 写真から読み取るときに、AI入力の指示に足す文（家計に関係ない写真は記録にしない） */
export const PHOTO_PROMPT_EXTRA = [
  '# 写真について',
  '- 添付はスマホで撮った写真1枚です。レシート・セルフレジや券売機などの決済完了の画面・自販機などの値段の表示のどれでもなければ、空の配列 [] を返す（風景・人・料理・メモ・書類などは記録にしない）',
  '- 支払いだけを読み取る（type は expense）。レシートが複数写っていれば1枚ずつ',
].join('\n');

export type PhotoRecordPlan = { draft: ImportDraft; status: 'recorded' | 'duplicate' };

/**
 * 写真から読み取った行のうち、記録にするもの: 支払いで、レシート・決済画面・値段の表示から読んだもの。
 * 口座が決まらない行は現金で払ったとみなす。重複の可能性のある行（メールで記録済みも）は記録せず「重複」に回す
 */
export function planPhotoRecords(drafts: readonly ImportDraft[], cashAccountId: string | null): PhotoRecordPlan[] {
  return drafts
    .filter((d) => d.type === 'expense' && d.source !== 'other')
    .map((d) => ({
      ...d,
      fromAccountId: d.fromAccountId ?? cashAccountId,
      note: d.fromAccountId ? d.note : '現金と判断',
    }))
    .filter((d) => d.fromAccountId)
    .map((draft) => ({ draft, status: draft.duplicate ? 'duplicate' : 'recorded' }));
}
