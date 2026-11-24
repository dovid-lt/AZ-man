import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltip } from '@angular/material/tooltip';
import { Totals, groupTotals } from '../../core/calc';
import { ClockService } from '../../core/clock.service';
import { DataStore } from '../../core/data.store';
import { Id, ProjectFilter, Shift } from '../../core/models';
import { dayRange, filteredProjects, summarize } from '../../core/summary';
import { DayLabelComponent } from '../day-label.component';
import { FORMAT_PIPES } from '../format.pipes';
import { DialogService } from './dialog.service';

interface ShiftRow {
  shift: Shift;
  start: number;
  end: number;
  open: boolean;
  totals: Totals;
}

/** פירוט יום: משמרות, עם גישה לעריכה ולהערה. */
@Component({
  imports: [
    MatDialogModule,
    MatButtonModule,
    MatIconModule,
    MatTooltip,
    DayLabelComponent,
    ...FORMAT_PIPES,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h2 mat-dialog-title>פירוט <app-day-label [time]="data.day" /></h2>
    <mat-dialog-content>
      <div class="summary-line">
        <span
          >סה"כ <b class="num">{{ sum().totals.ms | duration }}</b> שעות</span
        >
        <span class="num"
          ><b>{{ sum().totals.amount | money }}</b></span
        >
        @if (sum().totals.unratedMs) {
          <span class="warn" matTooltip="זמן לפני התעריף הראשון — נספר בשעות, סכום 0">
            <mat-icon inline>warning</mat-icon> {{ sum().totals.unratedMs | duration }} ללא תעריף
          </span>
        }
        @if (sum().broken.length) {
          <button mat-button class="warn" (click)="dialogs.brokenList(data.filter, sum().range)">
            <mat-icon>link_off</mat-icon> {{ sum().broken.length }} רשומות שבורות
          </button>
        }
      </div>

      @if (rows().length) {
        <table class="table">
          <thead>
            <tr>
              @if (multi()) {
                <th>פרויקט</th>
              }
              <th>כניסה</th>
              <th>יציאה</th>
              <th>משך</th>
              <th>סכום</th>
              <th>הערה</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            @for (r of rows(); track r.shift.id) {
              <tr>
                @if (multi()) {
                  <td>{{ store.projectName(r.shift.projectId) }}</td>
                }
                <td class="num">{{ r.start | hm }}</td>
                <td class="num">{{ r.open ? 'פתוחה' : (r.end | hm) }}</td>
                <td class="num">{{ r.totals.ms | duration }}</td>
                <td class="num">
                  {{ r.totals.amount | money }}
                  @if (r.totals.unratedMs) {
                    <mat-icon inline class="warn" matTooltip="חלק מהזמן ללא תעריף"
                      >warning</mat-icon
                    >
                  }
                </td>
                <td class="note">{{ r.shift.note }}</td>
                <td>
                  <button
                    mat-icon-button
                    matTooltip="עריכה והערה"
                    (click)="dialogs.editShift(r.shift.id)"
                  >
                    <mat-icon>edit</mat-icon>
                  </button>
                </td>
              </tr>
            }
          </tbody>
        </table>
      } @else {
        <p class="muted">אין משמרות ביום הזה.</p>
      }

      @if (multi() && projectRows().length > 1) {
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
      }
    </mat-dialog-content>
    <mat-dialog-actions><button mat-button mat-dialog-close>סגירה</button></mat-dialog-actions>
  `,
})
export class DayDetailDialog {
  protected readonly data = inject<{ day: number; filter: ProjectFilter }>(MAT_DIALOG_DATA);
  protected readonly store = inject(DataStore);
  protected readonly dialogs = inject(DialogService);
  private readonly clock = inject(ClockService);

  protected readonly sum = computed(() =>
    summarize(
      this.store.shifts(),
      this.store.projects(),
      this.data.filter,
      dayRange(this.data.day),
      this.clock.now(),
    ),
  );

  protected readonly multi = computed(
    () => filteredProjects(this.store.projects(), this.data.filter).length > 1,
  );

  protected readonly rows = computed<ShiftRow[]>(() => {
    const by = new Map<Id, ShiftRow>();
    for (const seg of this.sum().segments) {
      let r = by.get(seg.shift.id);
      if (!r) {
        r = {
          shift: seg.shift,
          start: seg.start,
          end: seg.end,
          open: seg.shift.end == null,
          totals: { ms: 0, amount: 0, unratedMs: 0 },
        };
        by.set(seg.shift.id, r);
      }
      r.start = Math.min(r.start, seg.start);
      r.end = Math.max(r.end, seg.end);
      r.totals.ms += seg.end - seg.start;
      r.totals.amount += seg.amount;
      if (seg.rate == null) r.totals.unratedMs += seg.end - seg.start;
    }
    return [...by.values()].sort((a, b) => a.start - b.start);
  });

  protected readonly projectRows = computed(() => {
    const m = groupTotals(this.sum().segments, (s) => s.projectId);
    return [...m.entries()].map(([id, totals]) => ({
      id,
      name: this.store.projectName(id),
      totals,
    }));
  });
}
