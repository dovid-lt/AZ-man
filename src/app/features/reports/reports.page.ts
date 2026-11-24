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
}
