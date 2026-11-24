import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { DataStore } from '../../core/data.store';
import { Id, Shift } from '../../core/models';
import { floorSecond, fromLocalInput, hm, shortDate, toLocalInput } from '../../core/time';
import { DayLabelComponent } from '../day-label.component';
import { FORMAT_PIPES } from '../format.pipes';
import { DialogService } from './dialog.service';

/** תיקון רשומה שבורה: השלמת השעה החסרה, צימוד לרשומה שבורה אחרת, או מחיקה. */
@Component({
  imports: [
    MatDialogModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatIconModule,
    FormsModule,
    DayLabelComponent,
    ...FORMAT_PIPES,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h2 mat-dialog-title class="warn-title"><mat-icon>link_off</mat-icon> תיקון רשומה שבורה</h2>
    @if (shift(); as s) {
      <mat-dialog-content class="form">
        <p>
          פרויקט <b>{{ store.projectName(s.projectId) }}</b> —
          @if (isIn()) {
            כניסה ב-<b><app-day-label [time]="s.start!" /> {{ s.start | hm }}</b> ללא יציאה.
          } @else {
            יציאה ב-<b><app-day-label [time]="s.end!" /> {{ s.end | hm }}</b> ללא כניסה.
          }
        </p>

        <h3>השלמת השעה החסרה</h3>
        <div class="row">
          <mat-form-field class="grow">
            <mat-label>{{ isIn() ? 'שעת יציאה' : 'שעת כניסה' }}</mat-label>
            <input
              matInput
              type="datetime-local"
              step="1"
              [ngModel]="value()"
              (ngModelChange)="value.set($event)"
            />
          </mat-form-field>
          <button mat-flat-button [disabled]="!!error()" (click)="complete(s)">השלמה</button>
        </div>
        @if (error(); as e) {
          <div class="error">{{ e }}</div>
        }

        @if (candidates().length) {
          <h3>צימוד לרשומה שבורה אחרת</h3>
          <ul class="plain-list">
            @for (c of candidates(); track c.id) {
              <li>
                <span>
                  {{ isIn() ? 'יציאה' : 'כניסה' }} ב-<app-day-label [time]="time(c)" />
                  {{ time(c) | hm }}
                </span>
                <button mat-stroked-button (click)="pair(s, c)">צימוד למשמרת אחת</button>
              </li>
            }
          </ul>
        }
      </mat-dialog-content>
      <mat-dialog-actions>
        <button mat-button class="danger-text push-start" (click)="remove(s)">
          <mat-icon>delete</mat-icon> מחיקת הרשומה
        </button>
        <button mat-button mat-dialog-close>סגירה</button>
      </mat-dialog-actions>
    } @else {
      <mat-dialog-content>הרשומה כבר תוקנה או נמחקה.</mat-dialog-content>
      <mat-dialog-actions><button mat-button mat-dialog-close>סגירה</button></mat-dialog-actions>
    }
  `,
})
export class FixBrokenDialog {
  private readonly data = inject<{ shiftId: Id }>(MAT_DIALOG_DATA);
  private readonly ref = inject(MatDialogRef<FixBrokenDialog>);
  protected readonly store = inject(DataStore);
  private readonly dialogs = inject(DialogService);

  protected readonly shift = computed(() => {
    const s = this.store.shift(this.data.shiftId);
    return s?.broken ? s : undefined;
  });
  protected readonly isIn = computed(() => this.shift()?.start != null);

  protected readonly value = signal(this.initialValue());
  private readonly valueT = computed(() => fromLocalInput(this.value()));

  protected readonly error = computed(() => {
    const s = this.shift();
    const t = this.valueT();
    if (!s) return null;
    if (t == null) return 'יש להזין תאריך ושעה';
    if (t > Date.now()) return 'השעה לא יכולה להיות בעתיד';
    if (s.start != null && t <= s.start)
      return `שעת היציאה חייבת להיות אחרי ${shortDate(s.start)} ${hm(s.start)}`;
    if (s.end != null && t >= s.end)
      return `שעת הכניסה חייבת להיות לפני ${shortDate(s.end)} ${hm(s.end)}`;
    return null;
  });

  /** רשומות שבורות משלימות באותו פרויקט, בסדר זמנים תקין. */
  protected readonly candidates = computed(() => {
    const s = this.shift();
    if (!s) return [];
    return this.store
      .shifts()
      .filter((c) => c.broken && c.id !== s.id && c.projectId === s.projectId)
      .filter((c) =>
        s.start != null ? c.end != null && c.end > s.start : c.start != null && c.start < s.end!,
      )
      .sort((a, b) => this.time(a) - this.time(b));
  });

  protected time(s: Shift): number {
    return (s.start ?? s.end)!;
  }

  private initialValue(): string {
    const s = this.store.shift(this.data.shiftId);
    const base = s?.start ?? s?.end ?? Date.now();
    return toLocalInput(floorSecond(s?.start != null ? Date.now() : base - 60_000));
  }

  protected complete(s: Shift): void {
    if (this.error()) return;
    const t = this.valueT()!;
    this.store.updateShift(
      s.id,
      s.start != null ? { end: t, broken: false } : { start: t, broken: false },
    );
    this.ref.close(true);
  }

  protected pair(s: Shift, c: Shift): void {
    if (s.start != null) this.store.pairBroken(s.id, c.id);
    else this.store.pairBroken(c.id, s.id);
    this.ref.close(true);
  }

  protected async remove(s: Shift): Promise<void> {
    const ok = await this.dialogs.confirm({
      title: 'מחיקת רשומה שבורה',
      message: 'למחוק את הרשומה? הפעולה אינה הפיכה.',
      ok: 'מחיקה',
      danger: true,
    });
    if (!ok) return;
    this.store.deleteShift(s.id);
    this.ref.close(true);
  }
}
