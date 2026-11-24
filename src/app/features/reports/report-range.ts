import { ReportParams, TimeRange } from '../../core/models';
import { dayRange } from '../../core/summary';
import {
  addDays,
  addMonths,
  dateKey,
  dayLabel,
  monthName,
  parseDateKey,
  shortDate,
  startOfMonth,
  startOfWeek,
} from '../../core/time';

export function reportRange(p: ReportParams): TimeRange {
  const a = parseDateKey(p.anchor);
  switch (p.kind) {
    case 'day':
      return dayRange(a);
    case 'week': {
      const from = startOfWeek(a);
      return { from, to: addDays(from, 7) };
    }
    case 'month': {
      const from = startOfMonth(a);
      return { from, to: addMonths(from, 1) };
    }
    case 'custom': {
      const [f, t] = [p.from, p.to].sort();
      return { from: parseDateKey(f), to: addDays(parseDateKey(t), 1) };
    }
  }
}

/** העוגן של התקופה הקודמת/הבאה. */
export function stepAnchor(p: ReportParams, dir: -1 | 1): string {
  const a = parseDateKey(p.anchor);
  switch (p.kind) {
    case 'day':
      return dateKey(addDays(a, dir));
    case 'week':
      return dateKey(addDays(startOfWeek(a), 7 * dir));
    case 'month':
      return dateKey(addMonths(startOfMonth(a), dir));
    default:
      return p.anchor;
  }
}

export function rangeLabel(p: ReportParams): string {
  const r = reportRange(p);
  const last = addDays(r.to, -1);
  switch (p.kind) {
    case 'day':
      return `${dayLabel(r.from)}/${new Date(r.from).getFullYear()}`;
    case 'month':
      return `${monthName(r.from)} ${new Date(r.from).getFullYear()}`;
    default:
      return `${shortDate(r.from)} – ${shortDate(last)}`;
  }
}

/** החודש הלועזי האחרון שהסתיים. */
export function lastFinishedMonth(now: number): number {
  return addMonths(startOfMonth(now), -1);
}
