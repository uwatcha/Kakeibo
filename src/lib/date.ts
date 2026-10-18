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
