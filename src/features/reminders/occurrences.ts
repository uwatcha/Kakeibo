import { addDays, toTokyoDateString } from '@/lib/date';

/**
 * from から days 日ごとの hour 時（日本時間）のうち、now より後の count 回。
 * from の日は数えない（変えたその日にすぐ通知しない）
 */
export function nextOccurrences(from: string, days: number, hour: number, now: number, count: number): Date[] {
  if (days <= 0) return [];
  const at = (date: string) => new Date(`${date}T${String(hour).padStart(2, '0')}:00:00+09:00`);
  // 今日より前の回は飛ばす
  const today = toTokyoDateString(new Date(now));
  const passed = Math.max(0, Math.floor((Date.parse(today) - Date.parse(from)) / 86_400_000 / days));
  const out: Date[] = [];
  for (let k = Math.max(1, passed); out.length < count; k++) {
    const date = at(addDays(from, k * days));
    if (date.getTime() > now) out.push(date);
  }
  return out;
}
