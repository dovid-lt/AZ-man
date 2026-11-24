import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltip } from '@angular/material/tooltip';
import { DataStore } from '../../core/data.store';
import { FIRST_RATE_DATE, Id, Rate } from '../../core/models';
import { dateKey, parseDateKey, shortDate } from '../../core/time';
import { DialogService } from './dialog.service';

export interface RateHistoryData {
  projectId: Id;
}

/** היסטוריית התעריפים של פרויקט — עריכה רטרואקטיבית מלאה. */
@Component({
  imports: [MatDialogModule, MatButtonModule, MatIconModule, MatTooltip],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h2 mat-dialog-title>היסטוריית תעריפים — {{ project()?.name }}</h2>
    <mat-dialog-content>
      <table class="table">
        <thead>
          <tr>
            <th>מתאריך</th>
            <th>תעריף לשעה (₪)</th>
            <th></th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          @for (r of rates(); track r.id) {
            <tr [class.current]="r.id === currentId()">
              <td>
                @if (r.startDate === FIRST) {
                  מההתחלה
                } @else {
                  <input
                    class="cell-input"
                    type="date"
                    [value]="r.startDate"
                    (change)="setDate(r, $any($event.target).value)"
                  />
                }
              </td>
              <td>
                <input
                  class="cell-input num"
                  type="number"
                  min="0"
                  step="0.01"
                  [value]="r.hourly"
                  (change)="setValue(r, $any($event.target).value)"
                />
              </td>
              <td>
                @if (r.id === currentId()) {
                  <span class="muted">בתוקף</span>
                } @else if (r.startDate > today) {
                  <span class="muted">עתידי</span>
                }
              </td>
              <td>
                <button mat-icon-button matTooltip="מחיקת התעריף" (click)="remove(r)">
                  <mat-icon>close</mat-icon>
                </button>
              </td>
            </tr>
          } @empty {
            <tr>
              @if (project()?.noRate) {
                <td colspan="4" class="muted">ללא תעריף</td>
              } @else {
                <td colspan="4" class="warn">
                  <mat-icon inline>warning</mat-icon> אין תעריף — שעות ייספרו עם סכום 0
                </td>
              }
            </tr>
          }
        </tbody>
      </table>
      <p class="muted">שינוי כאן הוא רטרואקטיבי: הסכומים יחושבו מחדש.</p>
    </mat-dialog-content>
    <mat-dialog-actions>
      <button mat-button (click)="add()"><mat-icon>add</mat-icon> הוספת תעריף</button>
      <button mat-flat-button mat-dialog-close>סגירה</button>
    </mat-dialog-actions>
  `,
  styles: `
    .current td {
      font-weight: 600;
    }
    .cell-input {
      font: inherit;
      padding: 4px 6px;
      border: 1px solid var(--app-border);
      border-radius: 6px;
      background: transparent;
      color: inherit;
      width: 150px;
    }
  `,
})
export class RateHistoryDialog {
  private readonly data = inject<RateHistoryData>(MAT_DIALOG_DATA);
  private readonly store = inject(DataStore);
  private readonly dialogs = inject(DialogService);

  protected readonly FIRST = FIRST_RATE_DATE;
  protected readonly today = dateKey(Date.now());

  protected readonly project = computed(() =>
    this.store.projects().find((p) => p.id === this.data.projectId),
  );
  protected readonly rates = computed(() =>
    [...(this.project()?.rates ?? [])].sort((a, b) => a.startDate.localeCompare(b.startDate)),
  );
  protected readonly currentId = computed(() => {
    this.project(); // תלות ב-signal
    return this.store.currentRate(this.data.projectId, this.today)?.id;
  });

  protected add(): void {
    const last = this.rates().at(-1);
    this.store.addRate(this.data.projectId, {
      startDate: this.rates().length ? this.today : FIRST_RATE_DATE,
      hourly: last?.hourly ?? 0,
    });
  }

  protected setDate(r: Rate, v: string): void {
    if (v) this.store.updateRate(this.data.projectId, r.id, { startDate: v });
  }

  protected setValue(r: Rate, v: number | string): void {
    const n = Number(v);
    if (Number.isFinite(n) && n >= 0)
      this.store.updateRate(this.data.projectId, r.id, { hourly: n });
  }

  protected async remove(r: Rate): Promise<void> {
    const from =
      r.startDate === FIRST_RATE_DATE ? 'מההתחלה' : `מ-${shortDate(parseDateKey(r.startDate))}`;
    const ok = await this.dialogs.confirm({
      title: 'מחיקת תעריף',
      message: `למחוק את התעריף ₪ ${r.hourly} ${from}? הסכומים יחושבו מחדש.`,
      ok: 'מחיקה',
      danger: true,
    });
    if (ok) this.store.deleteRate(this.data.projectId, r.id);
  }
}
