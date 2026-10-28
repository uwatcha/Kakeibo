import { type AccountKind, PERSON_KINDS } from '@/features/accounts/accountKinds';

type PickerAccount = { id: string; kind: AccountKind; is_archived: boolean; is_reserved: boolean };

/**
 * 口座を選ぶ欄に出す口座。非表示の口座は出さない。
 * 貸し借りの相手は、残高が 0 円か「普段使わない」なら、すべて表示にするまで隠す（相手が増えても候補が長くならないように）。
 * どの場合も、選んでいる口座は出す。balances がなければ残高では隠さない。
 */
export function pickerAccounts<T extends PickerAccount>(
  accounts: readonly T[],
  kinds: readonly AccountKind[],
  value: string | null,
  balances: ReadonlyMap<string, number> | undefined,
  showAll: boolean,
): { shown: T[]; hiddenCount: number } {
  const candidates = accounts.filter((a) => kinds.includes(a.kind) && (!a.is_archived || a.id === value));
  const isHidden = (a: T) =>
    !showAll &&
    a.id !== value &&
    PERSON_KINDS.includes(a.kind) &&
    (a.is_reserved || (balances !== undefined && (balances.get(a.id) ?? 0) === 0));
  // 普段使わない口座（is_reserved）は後ろに並べる（2026-10-28 改善要望）。それ以外の順はそのまま
  const shown = candidates
    .filter((a) => !isHidden(a))
    .sort((a, b) => Number(!!a.is_reserved) - Number(!!b.is_reserved));
  return { shown, hiddenCount: candidates.length - shown.length };
}
