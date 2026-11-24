import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltip } from '@angular/material/tooltip';
import { ClockService } from '../../core/clock.service';
import { DataStore } from '../../core/data.store';
import { Id, ProjectFilter, Shift, TimeRange, brokenTime, isOpen } from '../../core/models';
import { RangeSummary, filteredProjects, summarize } from '../../core/summary';
import { UiStore } from '../../core/ui.store';
import {
  addDays,
  addMonths,
  monthName,
  startOfDay,
  startOfMonth,
  startOfWeek,
} from '../../core/time';
import { Totals, emptyTotals } from '../../core/calc';
import { DayLabelComponent } from '../../shared/day-label.component';
import { DialogService } from '../../shared/dialogs/dialog.service';
import { FORMAT_PIPES } from '../../shared/format.pipes';
import { ProjectFilterComponent } from '../../shared/project-filter.component';

type CounterKind = 'day' | 'week' | 'month';

/** שורה בטבלת הימים האחרונים: חלק של משמרת בתוך יום אחד, או רשומה שבורה. */
interface DayRow {
  key: string;
  shift: Shift;
  day: number;
  /** לסדר: זמן התחלת השורה (או הזמן היחיד ברשומה שבורה) */
  sortTime: number;
  start: number | null;
  end: number | null;
  /** השורה ממשיכה משמרת מהיום הקודם (נחתכה בחצות) */
  contStart: boolean;
  /** המשמרת ממשיכה ליום הבא — היציאה מוצגת כ-24:00 */
  contEnd: boolean;
  active: boolean;
  broken: boolean;
  totals: Totals;
}

interface Counter {
  kind: CounterKind;
  title: string;
  sum: RangeSummary;
}

@Component({
  selector: 'app-dashboard',
  imports: [
    MatButtonModule,
    MatIconModule,
    MatTooltip,
    ProjectFilterComponent,
    DayLabelComponent,
    ...FORMAT_PIPES,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss',
})
export class DashboardComponent {
  private readonly store = inject(DataStore);
  protected readonly ui = inject(UiStore);
  private readonly clock = inject(ClockService);
  private readonly dialogs = inject(DialogService);

  protected readonly filter = this.ui.dashboardProjects;

  private sumOf(range: TimeRange, now: number): RangeSummary {
    return summarize(this.store.shifts(), this.store.projects(), this.filter(), range, now);
  }

  /** היום, השבוע (מיום ראשון) והחודש הלועזי — עד הרגע הנוכחי. */
  protected readonly counters = computed<Counter[]>(() => {
    const now = this.clock.now();
    const today = startOfDay(now);
    const week = startOfWeek(now);
    const month = startOfMonth(now);
    return [
      { kind: 'day', title: 'היום', sum: this.sumOf({ from: today, to: addDays(today, 1) }, now) },
      { kind: 'week', title: 'השבוע', sum: this.sumOf({ from: week, to: addDays(week, 7) }, now) },
      {
        kind: 'month',
        title: `חודש ${monthName(now)}`,
        sum: this.sumOf({ from: month, to: addMonths(month, 1) }, now),
      },
    ];
  });

  protected readonly multi = computed(
    () => filteredProjects(this.store.projects(), this.filter()).length > 1,
  );

  /**
   * 5 ימים קלנדריים כולל היום, שורה לכל משמרת בכל יום (משמרת שחוצה חצות מתפצלת),
   * ושורה לכל רשומה שבורה. מהחדש לישן; ימים ללא רשומות לא מופיעים.
   */
  protected readonly rows = computed<DayRow[]>(() => {
    const now = this.clock.now();
    const today = startOfDay(now);
    const sum = this.sumOf({ from: addDays(today, -4), to: addDays(today, 1) }, now);

    const by = new Map<string, DayRow>();
    for (const seg of sum.segments) {
      const key = `${seg.shift.id}|${seg.dayKey}`;
      let r = by.get(key);
      if (!r) {
        r = {
          key,
          shift: seg.shift,
          day: startOfDay(seg.start),
          sortTime: seg.start,
          start: seg.start,
          end: seg.end,
          contStart: false,
          contEnd: false,
          active: false,
          broken: false,
          totals: emptyTotals(),
        };
        by.set(key, r);
      }
      r.start = Math.min(r.start!, seg.start);
      r.end = Math.max(r.end!, seg.end);
      r.sortTime = r.start;
      r.totals.ms += seg.end - seg.start;
      r.totals.amount += seg.amount;
      if (seg.rate == null) r.totals.unratedMs += seg.end - seg.start;
    }

    const out = [...by.values()];
    for (const r of out) {
      const shiftEnd = r.shift.end ?? Math.max(r.shift.start!, now);
      r.contStart = r.start! > r.shift.start!;
      r.contEnd = r.end! < shiftEnd;
      r.active = isOpen(r.shift) && !r.contEnd;
    }

    for (const sh of sum.broken) {
      const t = brokenTime(sh);
      out.push({
        key: sh.id,
        shift: sh,
        day: startOfDay(t),
        sortTime: t,
        start: sh.start,
        end: sh.end,
        contStart: false,
        contEnd: false,
        active: false,
        broken: true,
        totals: emptyTotals(),
      });
    }

    return out.sort((a, b) => b.sortTime - a.sortTime);
  });

  protected projectName(id: Id): string {
    return this.store.projectName(id);
  }

  protected setFilter(f: ProjectFilter): void {
    this.ui.setDashboardProjects(f);
  }

  protected openCounter(c: Counter): void {
    if (c.kind === 'day') this.dialogs.dayDetail(c.sum.range.from, this.filter());
    else this.dialogs.periodDetail(c.title, c.sum.range, this.filter());
  }

  protected editRow(r: DayRow): void {
    if (r.broken) this.dialogs.fixBroken(r.shift.id);
    else this.dialogs.editShift(r.shift.id);
  }

  protected openBroken(range: TimeRange, e: Event): void {
    e.stopPropagation();
    this.dialogs.brokenList(this.filter(), range);
  }
}
