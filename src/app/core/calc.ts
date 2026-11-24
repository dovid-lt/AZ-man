import {
  Id,
  Project,
  ProjectFilter,
  Shift,
  TimeRange,
  brokenTime,
  isComplete,
  isOpen,
} from './models';
import { HOUR_MS, dateKey, nextMidnight, parseDateKey } from './time';

/** חלק של משמרת בתוך יום אחד ותחת תעריף אחד. */
export interface Segment {
  shift: Shift;
  projectId: Id;
  start: number;
  end: number;
  dayKey: string;
  /** null = אין תעריף בתוקף */
  rate: number | null;
  amount: number;
}

export interface Totals {
  ms: number;
  amount: number;
  /** זמן שאין לו תעריף (נספר בשעות, סכום 0) */
  unratedMs: number;
}

export const emptyTotals = (): Totals => ({ ms: 0, amount: 0, unratedMs: 0 });

interface RatePoint {
  at: number;
  hourly: number;
}

function ratePoints(project: Project | undefined): RatePoint[] {
  if (!project) return [];
  return project.rates
    .map((r) => ({ at: parseDateKey(r.startDate), hourly: r.hourly }))
    .sort((a, b) => a.at - b.at);
}

/** התעריף שתאריך ההתחלה שלו הוא האחרון שכבר עבר ברגע t. */
export function rateAt(project: Project | undefined, t: number): number | null {
  let r: number | null = null;
  for (const p of ratePoints(project)) {
    if (p.at <= t) r = p.hourly;
    else break;
  }
  return r;
}

/**
 * פירוק משמרת לחלקים: פיצול בחצות ובכל תאריך שינוי תעריף.
 * משמרת פתוחה נספרת עד now. רשומות שבורות לא נספרות.
 * אם ניתן range — החלקים נחתכים אליו.
 */
export function segmentShift(
  shift: Shift,
  project: Project | undefined,
  now: number,
  range?: TimeRange,
): Segment[] {
  let s: number;
  let e: number;
  if (isComplete(shift)) {
    s = shift.start!;
    e = shift.end!;
  } else if (isOpen(shift)) {
    s = shift.start!;
    e = Math.max(s, now);
  } else {
    return [];
  }
  if (range) {
    s = Math.max(s, range.from);
    e = Math.min(e, range.to);
  }
  if (e <= s) return [];

  const points = ratePoints(project);
  const out: Segment[] = [];
  let cur = s;
  while (cur < e) {
    let next = Math.min(e, nextMidnight(cur));
    const change = points.find((p) => p.at > cur);
    if (change && change.at < next) next = change.at;
    const rate = rateAt(project, cur);
    out.push({
      shift,
      projectId: shift.projectId,
      start: cur,
      end: next,
      dayKey: dateKey(cur),
      rate,
      amount: rate == null ? 0 : ((next - cur) / HOUR_MS) * rate,
    });
    cur = next;
  }
  return out;
}

export function matchesFilter(projectId: Id, filter: ProjectFilter): boolean {
  return filter == null || filter.includes(projectId);
}

export function overlaps(shift: Shift, range: TimeRange, now: number): boolean {
  if (shift.broken || shift.start == null) return false;
  const end = shift.end ?? now;
  return shift.start < range.to && end > range.from;
}

export function collectSegments(
  shifts: Shift[],
  projects: Project[],
  filter: ProjectFilter,
  range: TimeRange,
  now: number,
): Segment[] {
  const byId = new Map(projects.map((p) => [p.id, p]));
  const out: Segment[] = [];
  for (const sh of shifts) {
    if (!matchesFilter(sh.projectId, filter)) continue;
    if (!overlaps(sh, range, now)) continue;
    out.push(...segmentShift(sh, byId.get(sh.projectId), now, range));
  }
  return out;
}

export function brokenInRange(shifts: Shift[], filter: ProjectFilter, range: TimeRange): Shift[] {
  return shifts
    .filter((s) => s.broken && matchesFilter(s.projectId, filter))
    .filter((s) => {
      const t = brokenTime(s);
      return t >= range.from && t < range.to;
    })
    .sort((a, b) => brokenTime(a) - brokenTime(b));
}

export function addSegment(t: Totals, seg: Segment): void {
  const ms = seg.end - seg.start;
  t.ms += ms;
  t.amount += seg.amount;
  if (seg.rate == null) t.unratedMs += ms;
}

export function total(segments: Segment[]): Totals {
  const t = emptyTotals();
  segments.forEach((s) => addSegment(t, s));
  return t;
}

export function groupTotals<K>(segments: Segment[], key: (s: Segment) => K): Map<K, Totals> {
  const m = new Map<K, Totals>();
  for (const s of segments) {
    const k = key(s);
    let t = m.get(k);
    if (!t) m.set(k, (t = emptyTotals()));
    addSegment(t, s);
  }
  return m;
}

/** פירוט לפי תעריף (פרויקט + תעריף). */
export interface RateLine {
  projectId: Id;
  rate: number | null;
  totals: Totals;
}

export function rateLines(segments: Segment[]): RateLine[] {
  const m = new Map<string, RateLine>();
  for (const s of segments) {
    const k = `${s.projectId}|${s.rate}`;
    let l = m.get(k);
    if (!l) m.set(k, (l = { projectId: s.projectId, rate: s.rate, totals: emptyTotals() }));
    addSegment(l.totals, s);
  }
  return [...m.values()];
}
