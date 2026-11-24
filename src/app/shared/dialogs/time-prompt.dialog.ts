import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { floorSecond, fromLocalInput, shortDate, hm, toLocalInput } from '../../core/time';

export interface TimePromptData {
  title: string;
  message?: string;
  label?: string;
  /** השעה חייבת להיות אחרי min (לא כולל) */
  min?: number | null;
  /** השעה לא יכולה להיות אחרי max (כולל) */
  max: number;
  initial?: number;
  ok?: string;
}

export function validateTime(
  t: number | null,
  min: number | null | undefined,
  max: number,
): string | null {
  if (t == null) return 'יש להזין תאריך ושעה';
  if (min != null && t <= min) return `השעה חייבת להיות אחרי ${shortDate(min)} ${hm(min)}`;
  if (t > max) return `השעה לא יכולה להיות אחרי ${shortDate(max)} ${hm(max)}`;
  return null;
}

/** חלון לבחירת שעה. סגירה בלי אישור מחזירה undefined. */
@Component({
  imports: [MatDialogModule, MatButtonModule, MatFormFieldModule, MatInputModule, FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h2 mat-dialog-title>{{ data.title }}</h2>
    <mat-dialog-content>
      @if (data.message) {
        <p>{{ data.message }}</p>
      }
      <mat-form-field class="full">
        <mat-label>{{ data.label ?? 'תאריך ושעה' }}</mat-label>
        <input
          matInput
          type="datetime-local"
          step="1"
          [ngModel]="value()"
          (ngModelChange)="value.set($event)"
        />
      </mat-form-field>
      @if (error(); as e) {
        <div class="error">{{ e }}</div>
      }
    </mat-dialog-content>
    <mat-dialog-actions>
      <button mat-button mat-dialog-close>ביטול</button>
      <button mat-flat-button [disabled]="!!error()" (click)="ok()">
        {{ data.ok ?? 'אישור' }}
      </button>
    </mat-dialog-actions>
  `,
})
export class TimePromptDialog {
  protected readonly data = inject<TimePromptData>(MAT_DIALOG_DATA);
  private readonly ref = inject(MatDialogRef<TimePromptDialog, number>);

  protected readonly value = signal(toLocalInput(floorSecond(this.data.initial ?? this.data.max)));
  protected readonly time = computed(() => fromLocalInput(this.value()));
  protected readonly error = computed(() =>
    validateTime(this.time(), this.data.min, this.data.max),
  );

  protected ok(): void {
    if (!this.error()) this.ref.close(this.time()!);
  }
}
