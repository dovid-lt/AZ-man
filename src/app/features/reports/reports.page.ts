import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatTooltip } from '@angular/material/tooltip';
import { RateLine, Totals, emptyTotals, rateLines } from '../../core/calc';
import { ClockService } from '../../core/clock.service';
import { DataStore } from '../../core/data.store';
import { Id, ProjectFilter, RangeKind, Shift, brokenTime } from '../../core/models';
import { filteredProjects, summarize } from '../../core/summary';
import { UiStore } from '../../core/ui.store';
import { dateKey, monthName } from '../../core/time';
import { Cell, Row, buildXlsx, downloadBlob, excelDate, excelDuration } from '../../core/xlsx';
import { DayLabelComponent } from '../../shared/day-label.component';
import { DialogService } from '../../shared/dialogs/dialog.service';
import { FORMAT_PIPES } from '../../shared/format.pipes';
import { ProjectFilterComponent } from '../../shared/project-filter.component';
import { lastFinishedMonth, rangeLabel, reportRange, stepAnchor } from './report-range';

interface ShiftRow {
  type: 'shift';
  key: string;
  shift: Shift;
  start: number;
  end: number;
  open: boolean;
  rates: (number | null)[];
  totals: Totals;
}

interface BrokenRow {
  type: 'broken';
  key: string;
  shift: Shift;
  time: number;
}

interface ProjectRow {
  id: Id;
  name: string;
  totals: Totals;
  rates: RateLine[];
}

@Component({
  imports: [
    MatButtonModule,
    MatButtonToggleModule,
    MatFormFieldModule,
    MatInputModule,
    MatIconModule,
    MatTooltip,
    FormsModule,
    ProjectFilterComponent,
    DayLabelComponent,
    ...FORMAT_PIPES,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './reports.page.html',
  styleUrl: './reports.page.scss',
})
export class ReportsPage {
  protected readonly store = inject(DataStore);
  private readonly ui = inject(UiStore);
  private readonly clock = inject(ClockService);
  protected readonly dialogs = inject(DialogService);

  protected readonly params = this.ui.report;
  protected readonly range = computed(() => reportRange(this.params()));
  protected readonly label = computed(() => rangeLabel(this.params()));

  /** החודש האחרון שהסתיים — מתעדכן כשמתחלף חודש. */
  private readonly quickMonth = computed(() => lastFinishedMonth(this.clock.now()));
  protected readonly quickLabel = computed(() => monthName(this.quickMonth()));

  protected readonly sum = computed(() =>
    summarize(
      this.store.shifts(),
      this.store.projects(),
      this.params().projects,
      this.range(),
      this.clock.now(),
    ),
  );

  protected readonly multi = computed(
    () => filteredProjects(this.store.projects(), this.params().projects).length > 1,
  );

  /** פירוט לפי פרויקט, ובתוכו לפי תעריף כשחלו כמה תעריפים. */
  protected readonly projectRows = computed<ProjectRow[]>(() => {
    const s = this.sum();
    const lines = rateLines(s.segments).sort((a, b) => (a.rate ?? -1) - (b.rate ?? -1));
    return [...s.byProject.entries()]
      .map(([id, totals]) => ({
        id,
        name: this.store.projectName(id),
        totals,
        rates: lines.filter((l) => l.projectId === id),
      }))
      .sort((a, b) => a.name.localeCompare(b.name, 'he'));
  });

  protected readonly rows = computed<(ShiftRow | BrokenRow)[]>(() => {
    const s = this.sum();
    const by = new Map<Id, ShiftRow>();
    for (const seg of s.segments) {
      let r = by.get(seg.shift.id);
      if (!r) {
        r = {
          type: 'shift',
          key: seg.shift.id,
          shift: seg.shift,
          start: seg.start,
          end: seg.end,
          open: seg.shift.end == null,
          rates: [],
          totals: emptyTotals(),
        };
        by.set(seg.shift.id, r);
      }
      r.start = Math.min(r.start, seg.start);
      r.end = Math.max(r.end, seg.end);
      if (!r.rates.includes(seg.rate)) r.rates.push(seg.rate);
      r.totals.ms += seg.end - seg.start;
      r.totals.amount += seg.amount;
      if (seg.rate == null) r.totals.unratedMs += seg.end - seg.start;
    }
    const broken: BrokenRow[] = s.broken.map((b) => ({
      type: 'broken',
      key: b.id,
      shift: b,
      time: brokenTime(b),
    }));
    return [...by.values(), ...broken].sort((a, b) => this.rowTime(a) - this.rowTime(b));
  });

  protected rowTime(r: ShiftRow | BrokenRow): number {
    return r.type === 'shift' ? r.start : r.time;
  }

  protected rateText(rates: (number | null)[]): string {
    return rates.map((r) => (r == null ? 'ללא תעריף' : `₪ ${r}`)).join(' / ');
  }

  // ---------- פרמטרים ----------

  protected quick(): void {
    this.ui.setReport({ kind: 'month', anchor: dateKey(this.quickMonth()) });
  }

  protected setKind(kind: RangeKind): void {
    const p = this.params();
    if (kind === 'custom') {
      const r = this.range();
      this.ui.setReport({ kind, from: dateKey(r.from), to: dateKey(r.to - 1) });
    } else {
      this.ui.setReport({ kind, anchor: p.kind === 'custom' ? p.from : p.anchor });
    }
  }

  protected step(dir: -1 | 1): void {
    this.ui.setReport({ anchor: stepAnchor(this.params(), dir) });
  }

  protected today(): void {
    this.ui.setReport({ anchor: dateKey(Date.now()) });
  }

  protected setFrom(v: string): void {
    if (v) this.ui.setReport({ from: v });
  }

  protected setTo(v: string): void {
    if (v) this.ui.setReport({ to: v });
  }

  protected setFilter(f: ProjectFilter): void {
    this.ui.setReport({ projects: f });
  }

  protected print(): void {
    window.print();
  }

  /** ייצוא הדוח המוצג לקובץ Excel: גיליון סיכום וגיליון משמרות. */
  protected exportExcel(): void {
    const s = this.sum();
    const multi = this.multi();
    const b = (v: string): Cell => ({ v, bold: true });
    const dur = (ms: number, bold = false): Cell => ({ v: excelDuration(ms), s: 'duration', bold });
    const money = (n: number, bold = false): Cell => ({ v: n, s: 'money', bold });
    const rate = (r: number | null): Cell => (r == null ? { v: 'ללא תעריף' } : money(r));

    const summary: Row[] = [
      [b(`דוח ${this.label()}`)],
      [],
      ['סך שעות', dur(s.totals.ms, true)],
      ['סכום', money(s.totals.amount, true)],
    ];
    if (s.totals.unratedMs) summary.push(['שעות ללא תעריף', dur(s.totals.unratedMs)]);
    if (s.broken.length) summary.push(['רשומות שבורות (לא נכללו)', s.broken.length]);
    if (this.projectRows().length) {
      summary.push([], [b('פרויקט'), b('תעריף'), b('שעות'), b('סכום')]);
      for (const p of this.projectRows()) {
        summary.push([
          b(p.name),
          p.rates.length === 1 ? rate(p.rates[0].rate) : null,
          dur(p.totals.ms, true),
          money(p.totals.amount, true),
        ]);
        if (p.rates.length > 1) {
          for (const l of p.rates)
            summary.push([null, rate(l.rate), dur(l.totals.ms), money(l.totals.amount)]);
        }
      }
    }

    const head = [
      'תאריך',
      ...(multi ? ['פרויקט'] : []),
      'כניסה',
      'יציאה',
      'משך',
      'תעריף',
      'סכום',
      'הערה',
    ];
    const shifts: Row[] = [head.map(b)];
    for (const r of this.rows()) {
      const project = multi ? [this.store.projectName(r.shift.projectId)] : [];
      if (r.type === 'shift') {
        shifts.push([
          { v: excelDate(r.start), s: 'date' },
          ...project,
          { v: excelDate(r.start), s: 'time' },
          r.open ? 'פתוחה' : { v: excelDate(r.end), s: 'time' },
          dur(r.totals.ms),
          r.rates.length === 1 ? rate(r.rates[0]) : this.rateText(r.rates),
          money(r.totals.amount),
          r.shift.note,
        ]);
      } else {
        const t = (v: number | null): Cell | string =>
          v == null ? '?' : { v: excelDate(v), s: 'time' };
        shifts.push([
          { v: excelDate(r.time), s: 'date' },
          ...project,
          t(r.shift.start),
          t(r.shift.end),
          'רשומה שבורה — לא נכללת בסכום',
          null,
          null,
          r.shift.note,
        ]);
      }
    }
    if (this.rows().length) {
      const pad = multi ? [null] : [];
      shifts.push(
        [],
        [b('סה״כ'), ...pad, null, null, dur(s.totals.ms, true), null, money(s.totals.amount, true)],
      );
    }

    const blob = buildXlsx([
      { name: 'סיכום', rows: summary, widths: [26, 14, 12, 14] },
      { name: 'משמרות', rows: shifts, widths: [12, ...(multi ? [18] : []), 9, 9, 10, 14, 14, 40] },
    ]);
    const safe = this.label().replace(/[\\/:*?"<>|]/g, '-');
    downloadBlob(blob, `דוח ${safe}.xlsx`);
  }
}
