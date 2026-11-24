/** כל הפונקציות עובדות לפי השעון המקומי של הדפדפן (Asia/Jerusalem). */

export const HOUR_MS = 3_600_000;

const DAY_LETTERS = ['א׳', 'ב׳', 'ג׳', 'ד׳', 'ה׳', 'ו׳', 'ש׳'];

const hebrewFmt = new Intl.DateTimeFormat('he-u-ca-hebrew', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
});
const monthFmt = new Intl.DateTimeFormat('he', { month: 'long' });
const numFmt = new Intl.NumberFormat('he-IL', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const pad = (n: number) => String(n).padStart(2, '0');

export function startOfDay(t: number): number {
  const d = new Date(t);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

/** הוספת ימים קלנדריים (בטוח במעבר שעון). */
export function addDays(t: number, n: number): number {
  const d = new Date(t);
  d.setDate(d.getDate() + n);
  return d.getTime();
}

export function nextMidnight(t: number): number {
  return addDays(startOfDay(t), 1);
}

/** השבוע מתחיל ביום ראשון. */
export function startOfWeek(t: number): number {
  const d = new Date(startOfDay(t));
  d.setDate(d.getDate() - d.getDay());
  return d.getTime();
}

export function startOfMonth(t: number): number {
  const d = new Date(t);
  return new Date(d.getFullYear(), d.getMonth(), 1).getTime();
}

export function addMonths(t: number, n: number): number {
  const d = new Date(t);
  return new Date(d.getFullYear(), d.getMonth() + n, 1).getTime();
}

/** YYYY-MM-DD */
export function dateKey(t: number): string {
  const d = new Date(t);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function parseDateKey(k: string): number {
  const [y, m, d] = k.split('-').map(Number);
  return new Date(y, m - 1, d).getTime();
}

export function sameDay(a: number, b: number): boolean {
  return dateKey(a) === dateKey(b);
}

/** "יום ו׳ 20/11" */
export function dayLabel(t: number): string {
  const d = new Date(t);
  return `יום ${DAY_LETTERS[d.getDay()]} ${pad(d.getDate())}/${pad(d.getMonth() + 1)}`;
}

/** dd/MM/yyyy */
export function shortDate(t: number): string {
  const d = new Date(t);
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
}

export function hebrewDate(t: number): string {
  return hebrewFmt.format(new Date(t));
}

export function monthName(t: number): string {
  return monthFmt.format(new Date(t));
}

/** HH:mm */
export function hm(t: number): string {
  const d = new Date(t);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** H:MM או H:MM:SS */
export function duration(ms: number, seconds = false): string {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  return seconds ? `${h}:${pad(m)}:${pad(s)}` : `${h}:${pad(m)}`;
}

/** "₪ 1,234.56" */
export function money(n: number): string {
  return `₪ ${numFmt.format(n)}`;
}

/** ערך ל-input מסוג datetime-local (עם שניות, step=1) */
export function toLocalInput(t: number): string {
  const d = new Date(t);
  return `${dateKey(t)}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

export function fromLocalInput(v: string): number | null {
  if (!v) return null;
  const [date, time] = v.split('T');
  if (!date || !time) return null;
  const [y, mo, d] = date.split('-').map(Number);
  const [h, mi, s] = time.split(':').map(Number);
  const r = new Date(y, mo - 1, d, h, mi, s || 0).getTime();
  return Number.isNaN(r) ? null : r;
}

/** עיגול כלפי מטה לשנייה שלמה — ברירת מחדל לשדות זמן. */
export function floorSecond(t: number): number {
  return Math.floor(t / 1000) * 1000;
}
