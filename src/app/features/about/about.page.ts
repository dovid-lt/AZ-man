import { ChangeDetectionStrategy, Component } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';

/** אודות ועזרה. */
@Component({
  imports: [MatIconModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="card">
      <h2>אודות ועזרה</h2>

      <p>
        <mat-icon inline>storage</mat-icon>
        כל המידע נשמר מקומית בדפדפן שלך (IndexedDB) ואינו נשלח לשום שרת.
      </p>

      <p>
        <mat-icon inline>code</mat-icon>
        הפרויקט בקוד פתוח:
        <a [href]="repoUrl" target="_blank" rel="noopener" dir="ltr">{{ repoUrl }}</a>
      </p>

      <p>
        <mat-icon inline>person</mat-icon>
        נכתב על ידי דוד מחברת Pitronal.
      </p>
    </section>
  `,
  styles: `
    p {
      display: flex;
      align-items: center;
      gap: 8px;
      flex-wrap: wrap;
    }
  `,
})
export class AboutPage {
  protected readonly repoUrl = 'https://github.com/dovid-lt/AZ-man';
}
