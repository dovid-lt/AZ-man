import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { ClockService } from '../../core/clock.service';
import { DataStore } from '../../core/data.store';
import { ProjectFilter, TimeRange } from '../../core/models';
import { dayTotals, daysIn, filteredProjects, summarize } from '../../core/summary';
import { nextMidnight } from '../../core/time';
import { DayLabelComponent } from '../day-label.component';
import { FORMAT_PIPES } from '../format.pipes';
import { DialogService } from './dialog.service';

/** פירוט שבוע/חודש: לפי ימים, ולפי פרויקט כשנבחר יותר מפרויקט אחד. */
@Component({
  imports: [MatDialogModule, MatButtonModule, MatIconModule, DayLabelComponent, ...FORMAT_PIPES],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h2 mat-dialog-title>פירוט {{ data.title }}</h2>
    <mat-dialog-content>
      <div class="summary-line">
        <span
          >סה"כ <b class="num">{{ sum().totals.ms | duration }}</b> שעות</span
        >
        <span class="num"
          ><b>{{ sum().totals.amount | money }}</b></span
        >
        @if (sum().totals.unratedMs) {
          <span class="warn"
            ><mat-icon inline>warning</mat-icon> {{ sum().totals.unratedMs | duration }} ללא
            תעריף</span
          >
        }
        @if (sum().broken.length) {
          <button mat-button class="warn" (click)="dialogs.brokenList(data.filter, sum().range)">
            <mat-icon>link_off</mat-icon> {{ sum().broken.length }} רשומות שבורות
          </button>
        }
      </div>

      <div class="columns">
        <section>
          <h3>לפי ימים</h3>
          <table class="table clickable">
            <tbody>
              @for (d of days(); track d.day) {
                <tr (click)="dialogs.dayDetail(d.day, data.filter)" [class.muted]="!d.totals.ms">
                  <td><app-day-label [time]="d.day" /></td>
                  <td class="num">{{ d.totals.ms | duration }}</td>
                  <td class="num">{{ d.totals.amount | money }}</td>
                </tr>
              }
            </tbody>
          </table>
        </section>

        @if (multi()) {
          <section>
            <h3>לפי פרויקט</h3>
            <table class="table">
              <tbody>
                @for (p of projectRows(); track p.id) {
                  <tr>
                    <td>{{ p.name }}</td>
                    <td class="num">{{ p.totals.ms | duration }}</td>
                    <td class="num">{{ p.totals.amount | money }}</td>
                  </tr>
                }
              </tbody>
            </table>
          </section>
        }
      </div>
    </mat-dialog-content>
    <mat-dialog-actions><button mat-button mat-dialog-close>סגירה</button></mat-dialog-actions>
  `,
})
export class PeriodDetailDialog {
  protected readonly data = inject<{ title: string; range: TimeRange; filter: ProjectFilter }>(
    MAT_DIALOG_DATA,
  );
  protected readonly store = inject(DataStore);
  protected readonly dialogs = inject(DialogService);
  private readonly clock = inject(ClockService);

  protected readonly sum = computed(() =>
    summarize(
      this.store.shifts(),
      this.store.projects(),
      this.data.filter,
      this.data.range,
      this.clock.now(),
    ),
  );

  protected readonly multi = computed(
    () => filteredProjects(this.store.projects(), this.data.filter).length > 1,
  );

  /** ימים עד היום (כולל), ולא ימים עתידיים. */
  protected readonly days = computed(() => {
    const limit = Math.min(this.data.range.to, nextMidnight(this.clock.now()));
    const s = this.sum();
    return daysIn({ from: this.data.range.from, to: limit }).map((day) => ({
      day,
      totals: dayTotals(s, day),
    }));
  });

  protected readonly projectRows = computed(() =>
    filteredProjects(this.store.projects(), this.data.filter).map((p) => ({
      id: p.id,
      name: p.name,
      totals: this.sum().byProject.get(p.id) ?? { ms: 0, amount: 0, unratedMs: 0 },
    })),
  );
}
