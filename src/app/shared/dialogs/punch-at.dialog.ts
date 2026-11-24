import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { DataStore } from '../../core/data.store';
import { Id } from '../../core/models';
import type { Direction } from '../../core/punch.service';
import { UiStore } from '../../core/ui.store';
import { floorSecond, fromLocalInput, toLocalInput } from '../../core/time';
import { validateTime } from './time-prompt.dialog';

export interface PunchAtData {
  direction?: Direction;
}

export interface PunchAtResult {
  projectId: Id;
  direction: Direction;
  at: number;
}

/** כניסה או יציאה בשעה אחרת מעכשיו. אחרי האישור חלה אותה בדיקת עקביות. */
@Component({
  imports: [
    MatDialogModule,
    MatButtonModule,
    MatButtonToggleModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    FormsModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h2 mat-dialog-title>כניסה או יציאה בשעה אחרת</h2>
    <mat-dialog-content class="form">
      <mat-button-toggle-group [value]="direction()" (change)="direction.set($event.value)">
        <mat-button-toggle value="in">כניסה</mat-button-toggle>
        <mat-button-toggle value="out">יציאה</mat-button-toggle>
      </mat-button-toggle-group>
      <mat-form-field>
        <mat-label>פרויקט</mat-label>
        <mat-select [ngModel]="projectId()" (ngModelChange)="projectId.set($event)">
          @for (p of store.activeProjects(); track p.id) {
            <mat-option [value]="p.id">{{ p.name }}</mat-option>
          }
        </mat-select>
      </mat-form-field>
      <mat-form-field>
        <mat-label>תאריך ושעה</mat-label>
        <input
          matInput
          type="datetime-local"
          step="1"
          [ngModel]="value()"
          (ngModelChange)="value.set($event)"
        />
      </mat-form-field>
      @if (error(); as e) {
        <div class="error">{{ e }}</div>
      }
    </mat-dialog-content>
    <mat-dialog-actions>
      <button mat-button mat-dialog-close>ביטול</button>
      <button mat-flat-button [disabled]="!!error()" (click)="ok()">רישום</button>
    </mat-dialog-actions>
  `,
})
export class PunchAtDialog {
  private readonly data = inject<PunchAtData>(MAT_DIALOG_DATA);
  private readonly ref = inject(MatDialogRef<PunchAtDialog, PunchAtResult>);
  protected readonly store = inject(DataStore);
  private readonly ui = inject(UiStore);

  protected readonly projectId = signal(this.defaultProject());
  protected readonly direction = signal<Direction>(
    this.data.direction ?? (this.store.openShift(this.projectId()) ? 'out' : 'in'),
  );
  protected readonly value = signal(toLocalInput(floorSecond(Date.now())));
  private readonly time = computed(() => fromLocalInput(this.value()));

  protected readonly error = computed(() => {
    if (!this.projectId()) return 'יש לבחור פרויקט';
    return validateTime(this.time(), this.store.lastRecordTime(this.projectId()), Date.now());
  });

  private defaultProject(): Id {
    const cur = this.ui.currentProjectId();
    const active = this.store.activeProjects();
    return active.find((p) => p.id === cur)?.id ?? active[0]?.id ?? '';
  }

  protected ok(): void {
    if (this.error()) return;
    this.ref.close({ projectId: this.projectId(), direction: this.direction(), at: this.time()! });
  }
}
