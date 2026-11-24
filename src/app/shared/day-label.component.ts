import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { MatTooltip } from '@angular/material/tooltip';
import { dayLabel, hebrewDate } from '../core/time';

/** "יום ו׳ 20/11" עם תאריך עברי בריחוף. */
@Component({
  selector: 'app-day-label',
  imports: [MatTooltip],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<span class="day-label" [matTooltip]="hebrew()">{{ label() }}</span>`,
  styles: `
    .day-label {
      cursor: help;
      white-space: nowrap;
    }
  `,
})
export class DayLabelComponent {
  readonly time = input.required<number>();
  protected readonly label = computed(() => dayLabel(this.time()));
  protected readonly hebrew = computed(() => hebrewDate(this.time()));
}
