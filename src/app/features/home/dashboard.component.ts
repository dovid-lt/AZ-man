import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltip } from '@angular/material/tooltip';
import { ClockService } from '../../core/clock.service';
import { DataStore } from '../../core/data.store';
import { ProjectFilter, TimeRange, brokenTime } from '../../core/models';
import { RangeSummary, dayRange, dayTotals, summarize } from '../../core/summary';
import { UiStore } from '../../core/ui.store';
import {
  addDays,
  addMonths,
  monthName,
  startOfDay,
  startOfMonth,
  startOfWeek,
} from '../../core/time';
import { DayLabelComponent } from '../../shared/day-label.component';
import { DialogService } from '../../shared/dialogs/dialog.service';
import { FORMAT_PIPES } from '../../shared/format.pipes';
import { ProjectFilterComponent } from '../../shared/project-filter.component';

type CounterKind = 'day' | 'week' | 'month';

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

  /** 5 ימים קלנדריים כולל היום. */
  protected readonly lastDays = computed(() => {
    const now = this.clock.now();
    const today = startOfDay(now);
    const from = addDays(today, -4);
    const sum = this.sumOf({ from, to: addDays(today, 1) }, now);
    return [0, 1, 2, 3, 4].map((i) => {
      const day = addDays(from, i);
      const { from: f, to: t } = dayRange(day);
      const broken = sum.broken.filter((s) => brokenTime(s) >= f && brokenTime(s) < t).length;
      return { day, totals: dayTotals(sum, day), broken, today: i === 4 };
    });
  });

  protected setFilter(f: ProjectFilter): void {
    this.ui.setDashboardProjects(f);
  }

  protected openCounter(c: Counter): void {
    if (c.kind === 'day') this.dialogs.dayDetail(c.sum.range.from, this.filter());
    else this.dialogs.periodDetail(c.title, c.sum.range, this.filter());
  }

  protected openDay(day: number): void {
    this.dialogs.dayDetail(day, this.filter());
  }

  protected openBroken(range: TimeRange, e: Event): void {
    e.stopPropagation();
    this.dialogs.brokenList(this.filter(), range);
  }
}
