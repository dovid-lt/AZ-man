import { Segment, Totals, brokenInRange, collectSegments, groupTotals, total } from './calc';
import { Id, Project, ProjectFilter, Shift, TimeRange } from './models';
import { addDays, dateKey, startOfDay } from './time';

export interface RangeSummary {
  range: TimeRange;
  segments: Segment[];
  totals: Totals;
  byProject: Map<Id, Totals>;
  byDay: Map<string, Totals>;
  broken: Shift[];
}

export function summarize(
  shifts: Shift[],
  projects: Project[],
  filter: ProjectFilter,
  range: TimeRange,
  now: number,
): RangeSummary {
  const segments = collectSegments(shifts, projects, filter, range, now);
  return {
    range,
    segments,
    totals: total(segments),
    byProject: groupTotals(segments, (s) => s.projectId),
    byDay: groupTotals(segments, (s) => s.dayKey),
    broken: brokenInRange(shifts, filter, range),
  };
}

/** ימים קלנדריים בטווח (תחילת כל יום). */
export function daysIn(range: TimeRange): number[] {
  const out: number[] = [];
  for (let d = startOfDay(range.from); d < range.to; d = addDays(d, 1)) out.push(d);
  return out;
}

export function dayRange(day: number): TimeRange {
  const from = startOfDay(day);
  return { from, to: addDays(from, 1) };
}

export function dayTotals(summary: RangeSummary, day: number): Totals {
  return summary.byDay.get(dateKey(day)) ?? { ms: 0, amount: 0, unratedMs: 0 };
}

/** פרויקטים שנכללים בסינון בפועל. */
export function filteredProjects(projects: Project[], filter: ProjectFilter): Project[] {
  return filter == null ? projects : projects.filter((p) => filter.includes(p.id));
}
