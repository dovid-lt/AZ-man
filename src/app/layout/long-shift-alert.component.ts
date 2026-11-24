import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { ClockService } from '../core/clock.service';
import { DataStore } from '../core/data.store';
import { PunchService } from '../core/punch.service';
import { HOUR_MS } from '../core/time';
import { DayLabelComponent } from '../shared/day-label.component';
import { FORMAT_PIPES } from '../shared/format.pipes';

/** התראה בולטת על משמרת שפתוחה יותר מהסף שהוגדר. מוצגת גם מיד בטעינה. */
@Component({
  selector: 'app-long-shift-alert',
  imports: [MatButtonModule, MatIconModule, DayLabelComponent, ...FORMAT_PIPES],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @for (a of alerts(); track a.id) {
      <div class="alert" role="alert">
        <mat-icon>alarm</mat-icon>
        <span>
          משמרת ב<b>{{ a.name }}</b> פתוחה מ-<app-day-label [time]="a.start" /> {{ a.start | hm }} —
          כבר <b class="num">{{ a.ms | duration }}</b> שעות.
        </span>
        <button mat-flat-button (click)="punch.fixOpenExit(a.id)">תיקון שעת היציאה</button>
      </div>
    }
  `,
  styles: `
    .alert {
      display: flex;
      align-items: center;
      gap: 12px;
      flex-wrap: wrap;
      padding: 10px 16px;
      background: var(--app-alert-bg);
      color: var(--app-alert-fg);
      border-bottom: 1px solid var(--app-alert-fg);
      font-weight: 500;
    }
    span {
      flex: 1;
    }
  `,
})
export class LongShiftAlertComponent {
  private readonly store = inject(DataStore);
  private readonly clock = inject(ClockService);
  protected readonly punch = inject(PunchService);

  protected readonly alerts = computed(() => {
    const now = this.clock.now();
    const limit = this.store.settings().longShiftHours * HOUR_MS;
    return this.store
      .openShifts()
      .filter((s) => now - s.start! > limit)
      .map((s) => ({
        id: s.id,
        name: this.store.projectName(s.projectId),
        start: s.start!,
        ms: now - s.start!,
      }));
  });
}
