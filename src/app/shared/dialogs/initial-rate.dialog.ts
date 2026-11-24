import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';

export interface InitialRateData {
  projectName: string;
}

/** סכום — תעריף ראשון שחל על כל השעות. 'none' — "ללא תעריף" במכוון. */
export type InitialRateResult = number | 'none';

/** נשאל ברישום הראשון לפרויקט בלי תעריף. סגירה בלי תשובה מבטלת את הרישום. */
@Component({
  imports: [MatDialogModule, MatButtonModule, MatFormFieldModule, MatInputModule, FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h2 mat-dialog-title>תעריף — {{ data.projectName }}</h2>
    <form (submit)="$event.preventDefault(); ok()">
      <mat-dialog-content>
        <p>לפרויקט עדיין אין תעריף. התעריף יחול על כל השעות בפרויקט.</p>
        <mat-form-field class="full">
          <mat-label>תעריף לשעה (₪)</mat-label>
          <input
            matInput
            name="hourly"
            type="number"
            min="0"
            step="0.01"
            cdkFocusInitial
            [ngModel]="hourly()"
            (ngModelChange)="hourly.set($event)"
          />
        </mat-form-field>
      </mat-dialog-content>
      <mat-dialog-actions>
        <button mat-button type="button" mat-dialog-close>ביטול</button>
        <button mat-button type="button" (click)="none()">ללא תעריף</button>
        <button mat-flat-button type="submit" [disabled]="rate() == null">שמירה</button>
      </mat-dialog-actions>
    </form>
  `,
})
export class InitialRateDialog {
  protected readonly data = inject<InitialRateData>(MAT_DIALOG_DATA);
  private readonly ref = inject(MatDialogRef<InitialRateDialog, InitialRateResult>);

  protected readonly hourly = signal<number | string | null>(null);

  /** null = ריק או לא תקין. */
  protected readonly rate = computed(() => {
    const v = this.hourly();
    if (v == null || String(v).trim() === '') return null;
    const n = Number(v);
    return Number.isFinite(n) && n >= 0 ? n : null;
  });

  protected ok(): void {
    const r = this.rate();
    if (r != null) this.ref.close(r);
  }

  protected none(): void {
    this.ref.close('none');
  }
}
