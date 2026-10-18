export type Movement = { date: string; amount: number; from_account_id: string | null; to_account_id: string | null };

export type Shortage<M extends Movement = Movement> = {
  accountId: string;
  /** 初めてマイナスになる日 */
  date: string;
  /** 期間中のいちばん低い残高（マイナス） */
  lowest: number;
  /** 初めてマイナスになる日に、その口座から出ていく予定（足りなくなる原因の支払い） */
  causes: M[];
};

/**
 * 予定（未来の日付の記録）を日付順に反映して、途中でマイナスになる口座を探す（REQ-25）。
 * balances は今日の残高。through までの予定だけを見る。
 */
export function findShortages<M extends Movement>(
  balances: ReadonlyMap<string, number>,
  movements: readonly M[],
  today: string,
  through: string,
): Shortage<M>[] {
  const running = new Map(balances);
  const result = new Map<string, Shortage<M>>();
  const upcoming = movements
    .filter((m) => m.date > today && m.date <= through)
    .sort((a, b) => a.date.localeCompare(b.date));

  // 同じ日の入出金はまとめて反映する（給料と支払いが同じ日なら差し引きで判断）
  let index = 0;
  while (index < upcoming.length) {
    const date = upcoming[index].date;
    for (; index < upcoming.length && upcoming[index].date === date; index++) {
      const m = upcoming[index];
      if (m.from_account_id && running.has(m.from_account_id)) {
        running.set(m.from_account_id, running.get(m.from_account_id)! - m.amount);
      }
      if (m.to_account_id && running.has(m.to_account_id)) {
        running.set(m.to_account_id, running.get(m.to_account_id)! + m.amount);
      }
    }
    for (const [accountId, balance] of running) {
      if (balance >= 0) continue;
      const found = result.get(accountId);
      if (!found) {
        const causes = upcoming.filter((m) => m.date === date && m.from_account_id === accountId);
        result.set(accountId, { accountId, date, lowest: balance, causes });
      }
      else if (balance < found.lowest) found.lowest = balance;
    }
  }
  return [...result.values()].sort((a, b) => a.date.localeCompare(b.date));
}
