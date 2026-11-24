import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { brokenInRange, matchesFilter } from '../../core/calc';
import { DataStore } from '../../core/data.store';
import { ProjectFilter, TimeRange, brokenTime } from '../../core/models';
import { DayLabelComponent } from '../day-label.component';
import { FORMAT_PIPES } from '../format.pipes';
import { DialogService } from './dialog.service';

export interface BrokenListData {
  filter: ProjectFilter;
  range?: TimeRange;
  title?: string;
}

@Component({
  imports: [MatDialogModule, MatButtonModule, MatIconModule, DayLabelComponent, ...FORMAT_PIPES],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h2 mat-dialog-title class="warn-title">
      <mat-icon>link_off</mat-icon> {{ data.title ?? 'רשומות שבורות' }}
    </h2>
    <mat-dialog-content>
      @if (items().length) {
        <p class="muted">רשומות שבורות לא נכנסות לסיכומים עד שמתקנים אותן.</p>
        <table class="table">
          <thead>
            <tr>
              <th>פרויקט</th>
              <th>רשומה</th>
              <th>תאריך</th>
              <th>שעה</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            @for (s of items(); track s.id) {
              <tr class="broken-row">
                <td>{{ store.projectName(s.projectId) }}</td>
                <td>{{ s.start != null ? 'כניסה ללא יציאה' : 'יציאה ללא כניסה' }}</td>
                <td><app-day-label [time]="time(s)" /></td>
                <td class="num">{{ time(s) | hm }}</td>
                <td><button mat-button (click)="dialogs.fixBroken(s.id)">תיקון</button></td>
              </tr>
            }
          </tbody>
        </table>
      } @else {
        <p>אין רשומות שבורות.</p>
      }
    </mat-dialog-content>
    <mat-dialog-actions><button mat-button mat-dialog-close>סגירה</button></mat-dialog-actions>
  `,
})
export class BrokenListDialog {
  protected readonly data = inject<BrokenListData>(MAT_DIALOG_DATA);
  protected readonly store = inject(DataStore);
  protected readonly dialogs = inject(DialogService);

  protected readonly items = computed(() => {
    const shifts = this.store.shifts();
    if (this.data.range) return brokenInRange(shifts, this.data.filter, this.data.range);
    return shifts
      .filter((s) => s.broken && matchesFilter(s.projectId, this.data.filter))
      .sort((a, b) => brokenTime(a) - brokenTime(b));
  });

  protected time = brokenTime;
}
