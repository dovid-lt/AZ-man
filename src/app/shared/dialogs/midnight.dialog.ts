import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { FORMAT_PIPES } from '../format.pipes';

export interface MidnightData {
  projectName: string;
  start: number;
  end: number;
}

export type MidnightChoice = 'same' | 'separate';

/** יציאה מכניסה שנפתחה ביום קלנדרי קודם. */
@Component({
  imports: [MatDialogModule, MatButtonModule, MatIconModule, ...FORMAT_PIPES],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h2 mat-dialog-title class="warn-title">
      <mat-icon>warning</mat-icon> הכניסה הפתוחה היא מיום קודם
    </h2>
    <mat-dialog-content>
      <p>
        בפרויקט <b>{{ data.projectName }}</b> הכניסה הפתוחה היא מ-<b
          >{{ data.start | dayLabel }} {{ data.start | hm }}</b
        >, והיציאה היא ב-<b>{{ data.end | dayLabel }} {{ data.end | hm }}</b
        >.
      </p>
      <ul>
        <li><b>זו אותה משמרת:</b> המשמרת תיסגר ותפוצל ב-00:00 למשמרות נפרדות, כל אחת ביום שלה.</li>
        <li><b>לא שייך לאותה כניסה:</b> הכניסה והיציאה יישמרו כרשומות שבורות.</li>
      </ul>
    </mat-dialog-content>
    <mat-dialog-actions>
      <button mat-button mat-dialog-close>ביטול</button>
      <button mat-stroked-button [mat-dialog-close]="'separate'">לא שייך לאותה כניסה</button>
      <button mat-flat-button [mat-dialog-close]="'same'">זו אותה משמרת</button>
    </mat-dialog-actions>
  `,
})
export class MidnightDialog {
  protected readonly data = inject<MidnightData>(MAT_DIALOG_DATA);
}
