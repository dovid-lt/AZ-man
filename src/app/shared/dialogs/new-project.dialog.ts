import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';

/** hourly=null — בלי תעריף (יישאל בכניסה הראשונה). */
export interface NewProjectResult {
  name: string;
  hourly: number | null;
}

/** יצירת פרויקט: שם ותעריף ראשון אופציונלי. */
@Component({
  imports: [MatDialogModule, MatButtonModule, MatFormFieldModule, MatInputModule, FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h2 mat-dialog-title>פרויקט חדש</h2>
    <form (submit)="$event.preventDefault(); ok()">
      <mat-dialog-content>
        <mat-form-field class="full">
          <mat-label>שם</mat-label>
          <input
            matInput
            name="name"
            cdkFocusInitial
            [ngModel]="name()"
            (ngModelChange)="name.set($event)"
          />
        </mat-form-field>
        <mat-form-field class="full">
          <mat-label>תעריף לשעה (₪) — לא חובה</mat-label>
          <input
            matInput
            name="hourly"
            type="number"
            min="0"
            step="0.01"
            [ngModel]="hourly()"
            (ngModelChange)="hourly.set($event)"
          />
        </mat-form-field>
        @if (rateError(); as e) {
          <div class="error">{{ e }}</div>
        }
      </mat-dialog-content>
      <mat-dialog-actions>
        <button mat-button type="button" mat-dialog-close>ביטול</button>
        <button mat-flat-button type="submit" [disabled]="!valid()">יצירה</button>
      </mat-dialog-actions>
    </form>
  `,
})
export class NewProjectDialog {
  private readonly ref = inject(MatDialogRef<NewProjectDialog, NewProjectResult>);

  protected readonly name = signal('');
  protected readonly hourly = signal<number | string | null>(null);

  /** null = לא הוזן; NaN = לא תקין. */
  private readonly rate = computed(() => {
    const v = this.hourly();
    if (v == null || String(v).trim() === '') return null;
    const n = Number(v);
    return Number.isFinite(n) && n >= 0 ? n : NaN;
  });

  protected readonly rateError = computed(() =>
    Number.isNaN(this.rate()) ? 'תעריף לא תקין' : null,
  );
  protected readonly valid = computed(() => !!this.name().trim() && !this.rateError());

  protected ok(): void {
    if (this.valid()) this.ref.close({ name: this.name().trim(), hourly: this.rate() });
  }
}
