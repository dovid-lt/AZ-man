import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatSelectModule } from '@angular/material/select';
import { MatTooltip } from '@angular/material/tooltip';
import { RouterLink } from '@angular/router';
import { total, segmentShift } from '../../core/calc';
import { ClockService } from '../../core/clock.service';
import { DataStore } from '../../core/data.store';
import { Direction, PunchService } from '../../core/punch.service';
import { UiStore } from '../../core/ui.store';
import { FORMAT_PIPES } from '../../shared/format.pipes';

@Component({
  selector: 'app-action-panel',
  imports: [
    MatButtonModule,
    MatFormFieldModule,
    MatSelectModule,
    MatIconModule,
    MatTooltip,
    FormsModule,
    RouterLink,
    ...FORMAT_PIPES,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './action-panel.component.html',
  styleUrl: './action-panel.component.scss',
})
export class ActionPanelComponent {
  protected readonly store = inject(DataStore);
  private readonly ui = inject(UiStore);
  private readonly punchSvc = inject(PunchService);
  private readonly clock = inject(ClockService);

  protected readonly busy = signal(false);

  /** הפרויקט הנוכחי: האחרון שנבחר, ואם אינו פעיל — הפעיל הראשון. */
  protected readonly project = computed(() => {
    const active = this.store.activeProjects();
    return active.find((p) => p.id === this.ui.currentProjectId()) ?? active[0];
  });

  protected readonly open = computed(() => {
    const p = this.project();
    return p ? this.store.openShift(p.id) : undefined;
  });

  protected readonly expected = computed<Direction>(() => (this.open() ? 'out' : 'in'));

  protected readonly live = computed(() => {
    const s = this.open();
    if (!s) return null;
    const now = this.clock.now();
    const t = total(segmentShift(s, this.project(), now));
    return { since: s.start!, ms: now - s.start!, amount: t.amount, unrated: t.unratedMs > 0 };
  });

  protected hasOpen(projectId: string): boolean {
    return !!this.store.openShift(projectId);
  }

  protected select(id: string): void {
    this.ui.setCurrentProject(id);
  }

  protected async punch(dir: Direction): Promise<void> {
    const p = this.project();
    if (!p || this.busy()) return;
    this.busy.set(true);
    try {
      await this.punchSvc.punch(p.id, dir);
    } finally {
      this.busy.set(false);
    }
  }
}
