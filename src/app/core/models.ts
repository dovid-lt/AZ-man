export type Id = string;

/** תעריף לשעה שחל מתאריך התחלה (00:00 שעון מקומי) ועד התעריף הבא. */
export interface Rate {
  id: Id;
  /** YYYY-MM-DD */
  startDate: string;
  hourly: number;
}

export interface Project {
  id: Id;
  name: string;
  active: boolean;
  rates: Rate[];
}

/**
 * משמרת. המצבים האפשריים:
 * - שלמה: start ו-end מוגדרים, broken=false
 * - פתוחה: start בלבד, broken=false (לכל היותר אחת לפרויקט)
 * - שבורה: broken=true, ורק start או רק end מוגדר
 */
export interface Shift {
  id: Id;
  projectId: Id;
  start: number | null;
  end: number | null;
  broken: boolean;
  note: string;
}

export interface Settings {
  longShiftHours: number;
}

export interface AppData {
  version: 1;
  projects: Project[];
  shifts: Shift[];
  settings: Settings;
}

/** null = כל הפרויקטים (כולל פרויקטים שיתווספו בעתיד). */
export type ProjectFilter = Id[] | null;

export type RangeKind = 'day' | 'week' | 'month' | 'custom';

export interface ReportParams {
  kind: RangeKind;
  /** YYYY-MM-DD — יום בתוך התקופה המוצגת (ליום/שבוע/חודש) */
  anchor: string;
  /** YYYY-MM-DD — לטווח חופשי */
  from: string;
  to: string;
  projects: ProjectFilter;
}

export interface UiState {
  currentProjectId: Id | null;
  dashboardProjects: ProjectFilter;
  report: ReportParams;
}

export interface TimeRange {
  from: number;
  /** לא כולל */
  to: number;
}

export function isOpen(s: Shift): boolean {
  return !s.broken && s.start != null && s.end == null;
}

export function isComplete(s: Shift): boolean {
  return !s.broken && s.start != null && s.end != null;
}

/** זמן הרשומה לצורך סדר ובדיקת עקביות: הזמן המאוחר מבין כניסה ויציאה. */
export function recordTime(s: Shift): number {
  return Math.max(s.start ?? -Infinity, s.end ?? -Infinity);
}

/** הזמן שמייצג רשומה שבורה (הצד היחיד שקיים). */
export function brokenTime(s: Shift): number {
  return (s.start ?? s.end)!;
}
