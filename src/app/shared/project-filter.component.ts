import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectChange, MatSelectModule } from '@angular/material/select';
import { DataStore } from '../core/data.store';
import { ProjectFilter } from '../core/models';

const ALL = '__all__';

/** בחירה מרובה של פרויקטים: אחד, כמה או כולם (null). כולל פרויקטים לא פעילים. */
@Component({
  selector: 'app-project-filter',
  imports: [MatFormFieldModule, MatSelectModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <mat-form-field subscriptSizing="dynamic" class="filter">
      <mat-label>פרויקטים</mat-label>
      <mat-select multiple [value]="selected()" (selectionChange)="onChange($event)">
        <mat-select-trigger>{{ summary() }}</mat-select-trigger>
        <mat-option [value]="ALL">כל הפרויקטים</mat-option>
        @for (p of store.projects(); track p.id) {
          <mat-option [value]="p.id">
            {{ p.name }}
            @if (!p.active) {
              <span class="muted">(לא פעיל)</span>
            }
          </mat-option>
        }
      </mat-select>
    </mat-form-field>
  `,
  styles: `
    .filter {
      min-width: 220px;
    }
  `,
})
export class ProjectFilterComponent {
  protected readonly store = inject(DataStore);
  protected readonly ALL = ALL;

  readonly value = input<ProjectFilter>(null);
  readonly valueChange = output<ProjectFilter>();

  protected readonly selected = computed(() => this.value() ?? [ALL]);

  protected readonly summary = computed(() => {
    const v = this.value();
    if (v == null) return 'כל הפרויקטים';
    const names = v.map((id) => this.store.project(id)?.name).filter(Boolean);
    return names.length ? names.join(', ') : 'לא נבחרו פרויקטים';
  });

  protected onChange(e: MatSelectChange): void {
    const picked = e.value as string[];
    const hadAll = this.value() == null;
    if (!hadAll && picked.includes(ALL)) return this.valueChange.emit(null);
    const ids = picked.filter((x) => x !== ALL);
    this.valueChange.emit(ids.length ? ids : null);
  }
}
