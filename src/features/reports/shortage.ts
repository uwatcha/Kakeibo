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
      } else if (balance < found.lowest) found.lowest = balance;
    }
  }
  return [...result.values()].sort((a, b) => a.date.localeCompare(b.date));
}

export type CoverSource = { accountId: string; amount: number };
export type ShortageCover = {
  /** 振替で切り抜けられるか。false ならどこから振り替えても足りない */
  covered: boolean;
  /** 振り替える口座と額（今日振り替える想定。covered が false でも、出せる分は入れる） */
  sources: CoverSource[];
};

/**
 * 各口座が今日から先で一番少なくなるときの残高（今日の残高も含む）。
 * 今日この額までなら、その口座から振り替えても予定でマイナスにならない
 */
export function lowestAhead(
  balances: ReadonlyMap<string, number>,
  movements: readonly Movement[],
  today: string,
): Map<string, number> {
  const running = new Map(balances);
  const lowest = new Map(balances);
  const upcoming = movements.filter((m) => m.date > today).sort((a, b) => a.date.localeCompare(b.date));
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
    for (const [id, balance] of running) {
      if (balance < lowest.get(id)!) lowest.set(id, balance);
    }
  }
  return lowest;
}

/**
 * 足りなくなる口座ごとに、ほかの口座からの振替で切り抜けられるかを調べる。
 * sources は振替元にできる口座（使う順。普段使う口座を先に）。足りない額（−lowest）を、
 * 各口座の「今日から先で一番少ないときの残高」の範囲で前から順に割り当てる。
 * 足りなくなる日が早い口座から割り当て、同じ口座の余裕を二重に使わない
 */
export function planCovers(
  shortages: readonly Shortage[],
  lowest: ReadonlyMap<string, number>,
  sources: readonly string[],
): Map<string, ShortageCover> {
  const spare = new Map(sources.map((id) => [id, Math.max(0, lowest.get(id) ?? 0)]));
  const result = new Map<string, ShortageCover>();
  for (const s of shortages) {
    let need = 0 - s.lowest;
    const used: CoverSource[] = [];
    for (const id of sources) {
      if (need <= 0) break;
      if (id === s.accountId) continue;
      const available = spare.get(id) ?? 0;
      if (available <= 0) continue;
      const amount = Math.min(available, need);
      used.push({ accountId: id, amount });
      spare.set(id, available - amount);
      need -= amount;
    }
    result.set(s.accountId, { covered: need <= 0, sources: used });
  }
  return result;
}
