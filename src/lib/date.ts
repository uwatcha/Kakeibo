const tokyoDateFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Tokyo',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

/** 日本時間での日付を YYYY-MM-DD で返す（DB の date 列と同じ形） */
export function toTokyoDateString(date: Date = new Date()): string {
  return tokyoDateFormatter.format(date);
}

/** YYYY-MM-DD の月初（YYYY-MM-01）を返す */
export function monthStart(dateString: string): string {
  return `${dateString.slice(0, 7)}-01`;
}

/** 月初（YYYY-MM-01）に月数を足す */
export function addMonths(monthStartString: string, months: number): string {
  const [year, month] = monthStartString.split('-').map(Number);
  const index = year * 12 + (month - 1) + months;
  return `${Math.floor(index / 12)}-${String((index % 12) + 1).padStart(2, '0')}-01`;
}

/** 「2026年10月」 */
export function formatMonth(monthStartString: string): string {
  const [year, month] = monthStartString.split('-').map(Number);
  return `${year}年${month}月`;
}

const WEEKDAYS = ['日', '月', '火', '水', '木', '金', '土'];

/** 「10月18日（日）」 */
export function formatDay(dateString: string): string {
  const [year, month, day] = dateString.split('-').map(Number);
  const weekday = WEEKDAYS[new Date(Date.UTC(year, month - 1, day)).getUTCDay()];
  return `${month}月${day}日（${weekday}）`;
}

/** YYYY-MM-DD を日付ピッカー用の Date（その日の正午、端末のタイムゾーン）にする */
export function dateStringToLocalDate(dateString: string): Date {
  const [year, month, day] = dateString.split('-').map(Number);
  return new Date(year, month - 1, day, 12);
}

/** 日付ピッカーが返した Date（端末のタイムゾーンでの日付）を YYYY-MM-DD にする */
export function localDateToDateString(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

/** YYYY-MM-DD に日数を足す */
export function addDays(dateString: string, days: number): string {
  const [year, month, day] = dateString.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10);
}

/** from から to までの日数（両端を含む。同じ日なら 1） */
export function daysInclusive(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000) + 1;
}
