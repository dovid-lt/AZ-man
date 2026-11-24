import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { DataStore } from '../../core/data.store';
import { UiStore } from '../../core/ui.store';
import { addDays, dateKey, fromLocalInput } from '../../core/time';

/** הוספת משמרת בדיעבד: פרויקט, תאריך, שעת כניסה ושעת יציאה. */
@Component({
  imports: [
    MatDialogModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    FormsModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h2 mat-dialog-title>הוספת משמרת בדיעבד</h2>
    <mat-dialog-content class="form">
      <mat-form-field>
        <mat-label>פרויקט</mat-label>
        <mat-select [ngModel]="projectId()" (ngModelChange)="projectId.set($event)">
          @for (p of store.activeProjects(); track p.id) {
            <mat-option [value]="p.id">{{ p.name }}</mat-option>
          }
        </mat-select>
      </mat-form-field>
      <mat-form-field>
        <mat-label>תאריך</mat-label>
        <input matInput type="date" [ngModel]="date()" (ngModelChange)="date.set($event)" />
      </mat-form-field>
      <div class="row">
        <mat-form-field class="grow">
          <mat-label>שעת כניסה</mat-label>
          <input
            matInput
            type="time"
            [ngModel]="startTime()"
            (ngModelChange)="startTime.set($event)"
          />
        </mat-form-field>
        <mat-form-field class="grow">
          <mat-label>שעת יציאה</mat-label>
          <input matInput type="time" [ngModel]="endTime()" (ngModelChange)="endTime.set($event)" />
          @if (overnight()) {
            <mat-hint>היציאה ביום שאחרי</mat-hint>
          }
        </mat-form-field>
      </div>
      <mat-form-field>
        <mat-label>הערה</mat-label>
        <textarea
          matInput
          rows="2"
          [ngModel]="note()"
          (ngModelChange)="note.set($event)"
        ></textarea>
      </mat-form-field>
      @if (error(); as e) {
        <div class="error">{{ e }}</div>
      }
    </mat-dialog-content>
    <mat-dialog-actions>
      <button mat-button mat-dialog-close>ביטול</button>
      <button mat-flat-button [disabled]="!!error()" (click)="save()">הוספה</button>
    </mat-dialog-actions>
  `,
})
export class AddShiftDialog {
  protected readonly store = inject(DataStore);
  private readonly ui = inject(UiStore);
  private readonly ref = inject(MatDialogRef<AddShiftDialog>);

  protected readonly projectId = signal(this.defaultProject());
  protected readonly date = signal(dateKey(Date.now()));
  protected readonly startTime = signal('');
  protected readonly endTime = signal('');
  protected readonly note = signal('');

  private readonly startT = computed(() => fromLocalInput(`${this.date()}T${this.startTime()}`));
  protected readonly overnight = computed(
    () => !!this.startTime() && !!this.endTime() && this.endTime() <= this.startTime(),
  );
  private readonly endT = computed(() => {
    const e = fromLocalInput(`${this.date()}T${this.endTime()}`);
    return e != null && this.overnight() ? addDays(e, 1) : e;
  });

  protected readonly error = computed(() => {
    if (!this.projectId()) return 'יש לבחור פרויקט';
    const s = this.startT();
    const e = this.endT();
    if (s == null || e == null) return 'יש להזין תאריך, שעת כניסה ושעת יציאה';
    if (e === s) return 'משך המשמרת הוא אפס';
    if (e > Date.now()) return 'המשמרת לא יכולה להסתיים בעתיד';
    return null;
  });

  private defaultProject(): string {
    const cur = this.ui.currentProjectId();
    const active = this.store.activeProjects();
    return active.find((p) => p.id === cur)?.id ?? active[0]?.id ?? '';
  }

  protected save(): void {
    if (this.error()) return;
    this.store.addShift({
      projectId: this.projectId(),
      start: this.startT(),
      end: this.endT(),
      note: this.note().trim(),
    });
    this.ref.close(true);
  }
}
