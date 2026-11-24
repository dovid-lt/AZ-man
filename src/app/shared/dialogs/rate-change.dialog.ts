import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatRadioModule } from '@angular/material/radio';
import { FIRST_RATE_DATE } from '../../core/models';
import { dateKey, parseDateKey, shortDate } from '../../core/time';
import { FORMAT_PIPES } from '../format.pipes';

export interface RateChangeData {
  projectName: string;
  oldHourly: number;
  newHourly: number;
  /** YYYY-MM-DD — תאריך ההתחלה של התעריף שבתוקף */
  currentStart: string;
}

/** from: תעריף חדש מתאריך (נשמר בהיסטוריה). fix: עדכון התעריף הקיים במקומו. */
export type RateChangeResult = { mode: 'from'; date: string } | { mode: 'fix' };

type Mode = 'today' | 'date' | 'fix';

/** שינוי תעריף: מהיום, מתאריך אחר, או תיקון התעריף הקיים. */
@Component({
  imports: [
    MatDialogModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatRadioModule,
    FormsModule,
    ...FORMAT_PIPES,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h2 mat-dialog-title>שינוי תעריף — {{ data.projectName }}</h2>
    <mat-dialog-content>
      <p>
        מ-<b>{{ data.oldHourly | money }}</b> ל-<b>{{ data.newHourly | money }}</b> לשעה.
      </p>
      <mat-radio-group class="options" [ngModel]="mode()" (ngModelChange)="mode.set($event)">
        <mat-radio-button value="today">יחול מהיום ({{ todayLabel }})</mat-radio-button>
        <mat-radio-button value="date">יחול מתאריך אחר</mat-radio-button>
        @if (mode() === 'date') {
          <mat-form-field subscriptSizing="dynamic" class="date">
            <mat-label>מתאריך</mat-label>
            <input matInput type="date" [ngModel]="date()" (ngModelChange)="date.set($event)" />
          </mat-form-field>
        }
        <mat-radio-button value="fix">
          תיקון התעריף הקיים — הסכום החדש יחול על כל התקופה שלו{{ sinceLabel }}, בלי שורה חדשה
          בהיסטוריה
        </mat-radio-button>
      </mat-radio-group>
      @if (error(); as e) {
        <div class="error">{{ e }}</div>
      }
    </mat-dialog-content>
    <mat-dialog-actions>
      <button mat-button mat-dialog-close>ביטול</button>
      <button mat-flat-button [disabled]="!!error()" (click)="ok()">שמירה</button>
    </mat-dialog-actions>
  `,
  styles: `
    .options {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }
    .date {
      margin-inline-start: 40px;
      width: 200px;
    }
  `,
})
export class RateChangeDialog {
  protected readonly data = inject<RateChangeData>(MAT_DIALOG_DATA);
  private readonly ref = inject(MatDialogRef<RateChangeDialog, RateChangeResult>);

  private readonly today = dateKey(Date.now());
  protected readonly todayLabel = shortDate(Date.now());
  protected readonly sinceLabel =
    this.data.currentStart === FIRST_RATE_DATE
      ? ''
      : ` (מ-${shortDate(parseDateKey(this.data.currentStart))})`;

  protected readonly mode = signal<Mode>('today');
  protected readonly date = signal(this.today);

  protected readonly error = computed(() => {
    if (this.mode() !== 'date') return null;
    const d = this.date();
    if (!d) return 'יש לבחור תאריך';
    if (d <= this.data.currentStart)
      return `התאריך חייב להיות אחרי תחילת התעריף הנוכחי${this.sinceLabel}. לשינוי לאחור — "תיקון התעריף הקיים" או היסטוריית התעריפים.`;
    return null;
  });

  protected ok(): void {
    if (this.error()) return;
    const m = this.mode();
    this.ref.close(
      m === 'fix'
        ? { mode: 'fix' }
        : { mode: 'from', date: m === 'today' ? this.today : this.date() },
    );
  }
}
