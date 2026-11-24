import { ChangeDetectionStrategy, Component } from '@angular/core';
import { ActionPanelComponent } from './action-panel.component';
import { DashboardComponent } from './dashboard.component';

/** אזור הפעולה והדשבורד באותו דף. */
@Component({
  imports: [ActionPanelComponent, DashboardComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-action-panel />
    <app-dashboard />
  `,
  styles: `
    :host {
      display: flex;
      flex-direction: column;
      gap: 20px;
    }
  `,
})
export class HomePage {}
