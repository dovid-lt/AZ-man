import { describe, expect, it } from 'vitest';
import { collectSegments, rateAt, segmentShift, total } from './calc';
import { Project, Shift } from './models';
import { midnightsBetween } from './punch.service';
import { HOUR_MS } from './time';

const t = (y: number, m: number, d: number, h = 0, mi = 0) =>
  new Date(y, m - 1, d, h, mi).getTime();

const project: Project = {
  id: 'p1',
  name: 'א',
  active: true,
  rates: [
    { id: 'r2', startDate: '2026-11-10', hourly: 120 },
    { id: 'r1', startDate: '2026-11-01', hourly: 100 },
  ],
};

const shift = (start: number | null, end: number | null, broken = false): Shift => ({
  id: Math.random().toString(36),
  projectId: 'p1',
  start,
  end,
  broken,
  note: '',
});

describe('rateAt', () => {
  it('לפני התעריף הראשון אין תעריף', () => {
    expect(rateAt(project, t(2026, 10, 31, 23))).toBeNull();
  });
  it('התעריף האחרון שכבר התחיל', () => {
    expect(rateAt(project, t(2026, 11, 5))).toBe(100);
    expect(rateAt(project, t(2026, 11, 10))).toBe(120);
  });
});

describe('segmentShift', () => {
  it('משמרת רגילה ביום אחד', () => {
    const segs = segmentShift(shift(t(2026, 11, 5, 9), t(2026, 11, 5, 17)), project, Date.now());
    expect(segs).toHaveLength(1);
    expect(total(segs)).toEqual({ ms: 8 * HOUR_MS, amount: 800, unratedMs: 0 });
  });

  it('פיצול בחצות ובשינוי תעריף (שניהם ב-00:00 של 10/11)', () => {
    const segs = segmentShift(shift(t(2026, 11, 9, 22), t(2026, 11, 10, 2)), project, Date.now());
    expect(segs.map((s) => s.dayKey)).toEqual(['2026-11-09', '2026-11-10']);
    expect(total(segs).amount).toBe(2 * 100 + 2 * 120);
  });

  it('זמן לפני התעריף הראשון: נספר בשעות, סכום 0', () => {
    const segs = segmentShift(shift(t(2026, 10, 31, 22), t(2026, 11, 1, 1)), project, Date.now());
    expect(total(segs)).toEqual({ ms: 3 * HOUR_MS, amount: 100, unratedMs: 2 * HOUR_MS });
  });

  it('משמרת פתוחה נספרת עד now', () => {
    const now = t(2026, 11, 5, 10, 30);
    const segs = segmentShift(shift(t(2026, 11, 5, 9), null), project, now);
    expect(total(segs).amount).toBe(150);
  });

  it('רשומה שבורה לא נספרת', () => {
    expect(segmentShift(shift(t(2026, 11, 5, 9), null, true), project, Date.now())).toEqual([]);
    expect(segmentShift(shift(null, t(2026, 11, 5, 9), true), project, Date.now())).toEqual([]);
  });

  it('חיתוך לטווח', () => {
    const segs = collectSegments(
      [shift(t(2026, 11, 9, 22), t(2026, 11, 10, 2))],
      [project],
      null,
      { from: t(2026, 11, 10), to: t(2026, 11, 11) },
      Date.now(),
    );
    expect(total(segs)).toEqual({ ms: 2 * HOUR_MS, amount: 240, unratedMs: 0 });
  });

  it('שינוי תעריף רטרואקטיבי משנה את הסכום (לא נשמר)', () => {
    const s = shift(t(2026, 11, 5, 9), t(2026, 11, 5, 10));
    const p2: Project = {
      ...project,
      rates: [...project.rates, { id: 'r0', startDate: '2026-11-05', hourly: 200 }],
    };
    expect(total(segmentShift(s, p2, Date.now())).amount).toBe(200);
  });
});

describe('midnightsBetween', () => {
  it('אין חצות באותו יום', () => {
    expect(midnightsBetween(t(2026, 11, 5, 9), t(2026, 11, 5, 17))).toEqual([]);
  });
  it('כמה ימים', () => {
    expect(midnightsBetween(t(2026, 11, 5, 22), t(2026, 11, 7, 1))).toEqual([
      t(2026, 11, 6),
      t(2026, 11, 7),
    ]);
  });
});
