import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { DataStore } from '../../core/data.store';
import { Id, isOpen } from '../../core/models';
import { fromLocalInput, toLocalInput } from '../../core/time';
import { DialogService } from './dialog.service';

/** עריכת משמרת שלמה או פתוחה: כניסה, יציאה, פרויקט, הערה, מחיקה. */
@Component({
  imports: [
    MatDialogModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatIconModule,
    FormsModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h2 mat-dialog-title>עריכת משמרת</h2>
    @if (original) {
      <mat-dialog-content class="form">
        <mat-form-field>
          <mat-label>פרויקט</mat-label>
          <mat-select [ngModel]="projectId()" (ngModelChange)="projectId.set($event)">
            @for (p of projects(); track p.id) {
              <mat-option [value]="p.id">{{ p.name }}{{ p.active ? '' : ' (לא פעיל)' }}</mat-option>
            }
          </mat-select>
        </mat-form-field>
        <mat-form-field>
          <mat-label>כניסה</mat-label>
          <input
            matInput
            type="datetime-local"
            step="1"
            [ngModel]="start()"
            (ngModelChange)="start.set($event)"
          />
        </mat-form-field>
        <mat-form-field>
          <mat-label>יציאה</mat-label>
          <input
            matInput
            type="datetime-local"
            step="1"
            [ngModel]="end()"
            (ngModelChange)="end.set($event)"
          />
          @if (wasOpen) {
            <mat-hint>ריק = המשמרת נשארת פתוחה</mat-hint>
          }
        </mat-form-field>
        <mat-form-field>
          <mat-label>הערה</mat-label>
          <textarea
            matInput
            rows="3"
            [ngModel]="note()"
            (ngModelChange)="note.set($event)"
          ></textarea>
        </mat-form-field>
        @if (error(); as e) {
          <div class="error">{{ e }}</div>
        }
      </mat-dialog-content>
      <mat-dialog-actions>
        <button mat-button class="danger-text push-start" (click)="remove()">
          <mat-icon>delete</mat-icon> מחיקה
        </button>
        <button mat-button mat-dialog-close>ביטול</button>
        <button mat-flat-button [disabled]="!!error()" (click)="save()">שמירה</button>
      </mat-dialog-actions>
    } @else {
      <mat-dialog-content>המשמרת לא נמצאה (ייתכן שנמחקה בלשונית אחרת).</mat-dialog-content>
      <mat-dialog-actions><button mat-button mat-dialog-close>סגירה</button></mat-dialog-actions>
    }
  `,
})
export class ShiftEditDialog {
  private readonly data = inject<{ shiftId: Id }>(MAT_DIALOG_DATA);
  private readonly ref = inject(MatDialogRef<ShiftEditDialog>);
  private readonly store = inject(DataStore);
  private readonly dialogs = inject(DialogService);

  protected readonly original = this.store.shift(this.data.shiftId);
  protected readonly wasOpen = !!this.original && isOpen(this.original);

  protected readonly projectId = signal(this.original?.projectId ?? '');
  protected readonly start = signal(
    this.original?.start != null ? toLocalInput(this.original.start) : '',
  );
  protected readonly end = signal(
    this.original?.end != null ? toLocalInput(this.original.end) : '',
  );
  protected readonly note = signal(this.original?.note ?? '');

  protected readonly projects = computed(() =>
    this.store.projects().filter((p) => p.active || p.id === this.original?.projectId),
  );

  private readonly startT = computed(() => fromLocalInput(this.start()));
  private readonly endT = computed(() => fromLocalInput(this.end()));

  protected readonly error = computed(() => {
    const s = this.startT();
    const e = this.endT();
    const now = Date.now();
    if (s == null) return 'יש להזין שעת כניסה';
    if (s > now) return 'שעת הכניסה לא יכולה להיות בעתיד';
    if (e == null) {
      if (!this.wasOpen) return 'יש להזין שעת יציאה';
      const other = this.store.openShift(this.projectId());
      if (other && other.id !== this.original?.id) return 'בפרויקט הזה כבר יש משמרת פתוחה';
      return null;
    }
    if (e <= s) return 'שעת היציאה חייבת להיות אחרי שעת הכניסה';
    if (e > now) return 'שעת היציאה לא יכולה להיות בעתיד';
    return null;
  });

  protected save(): void {
    if (this.error() || !this.original) return;
    this.store.updateShift(this.original.id, {
      projectId: this.projectId(),
      start: this.startT(),
      end: this.endT(),
      note: this.note().trim(),
    });
    this.ref.close(true);
  }

  protected async remove(): Promise<void> {
    if (!this.original) return;
    const ok = await this.dialogs.confirm({
      title: 'מחיקת משמרת',
      message: 'למחוק את המשמרת? הפעולה אינה הפיכה.',
      ok: 'מחיקה',
      danger: true,
    });
    if (!ok) return;
    this.store.deleteShift(this.original.id);
    this.ref.close(true);
  }
}
