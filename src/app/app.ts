import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDividerModule } from '@angular/material/divider';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatTabsModule } from '@angular/material/tabs';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatTooltip } from '@angular/material/tooltip';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { PunchService } from './core/punch.service';
import { LongShiftAlertComponent } from './layout/long-shift-alert.component';
import { DialogService } from './shared/dialogs/dialog.service';
import type { Direction } from './core/punch.service';

@Component({
  selector: 'app-root',
  imports: [
    RouterOutlet,
    RouterLink,
    RouterLinkActive,
    MatToolbarModule,
    MatTabsModule,
    MatButtonModule,
    MatIconModule,
    MatMenuModule,
    MatDividerModule,
    MatTooltip,
    LongShiftAlertComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {
  private readonly dialogs = inject(DialogService);
  private readonly punch = inject(PunchService);
  protected readonly router = inject(Router);

  protected readonly tabs = [
    { path: '/', label: 'פעולה ודשבורד', exact: true },
    { path: '/reports', label: 'דוחות', exact: false },
    { path: '/about', label: 'אודות ועזרה', exact: false },
  ];

  protected addShift(): void {
    this.dialogs.addShift();
  }

  /** כניסה או יציאה בשעה אחרת מעכשיו — דרך התפריט בלבד. */
  protected async punchAt(direction: Direction): Promise<void> {
    const r = await this.dialogs.punchAt({ direction });
    if (r) await this.punch.punch(r.projectId, r.direction, r.at);
  }

  protected brokenAll(): void {
    this.dialogs.brokenList(null, undefined, 'כל הרשומות השבורות');
  }
}
