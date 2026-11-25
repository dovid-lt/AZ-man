import { BreakpointObserver } from '@angular/cdk/layout';
import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatDividerModule } from '@angular/material/divider';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatTabsModule } from '@angular/material/tabs';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatTooltip } from '@angular/material/tooltip';
import { map } from 'rxjs';
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

  /** מסך צר: הלשוניות המשניות עוברות לתפריט שלוש הנקודות. */
  protected readonly narrow = toSignal(
    inject(BreakpointObserver)
      .observe('(max-width: 719.98px)')
      .pipe(map((s) => s.matches)),
    { initialValue: false },
  );

  private readonly allTabs = [
    { path: '/', label: 'פעולה ודשבורד', icon: 'dashboard', exact: true, secondary: false },
    { path: '/reports', label: 'דוחות', icon: 'bar_chart', exact: false, secondary: false },
    { path: '/settings', label: 'פרויקטים ותעריפים', icon: 'settings', exact: false, secondary: true },
    { path: '/about', label: 'אודות ועזרה', icon: 'help_outline', exact: false, secondary: true },
  ];

  /** לשוניות שמוצגות בשורת הניווט. */
  protected readonly tabs = computed(() =>
    this.narrow() ? this.allTabs.filter((t) => !t.secondary) : this.allTabs,
  );

  /** לשוניות שעברו לתפריט (רק במסך צר). */
  protected readonly menuTabs = computed(() =>
    this.narrow() ? this.allTabs.filter((t) => t.secondary) : [],
  );

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
