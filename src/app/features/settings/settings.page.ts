import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSlideToggleChange, MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatTooltip } from '@angular/material/tooltip';
import { DataStore } from '../../core/data.store';
import { Project, Rate } from '../../core/models';
import { dateKey } from '../../core/time';
import { DialogService } from '../../shared/dialogs/dialog.service';

/** ניהול פרויקטים ותעריפים, והגדרת סף משמרת ארוכה. */
@Component({
  imports: [
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatIconModule,
    MatSlideToggleModule,
    MatTooltip,
    FormsModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './settings.page.html',
  styleUrl: './settings.page.scss',
})
export class SettingsPage {
  protected readonly store = inject(DataStore);
  private readonly dialogs = inject(DialogService);
  private readonly snack = inject(MatSnackBar);

  protected readonly newName = signal('');

  protected addProject(): void {
    const name = this.newName().trim();
    if (!name) return;
    this.store.addProject(name);
    this.newName.set('');
  }

  protected rename(p: Project, name: string): void {
    const n = name.trim();
    if (n && n !== p.name) this.store.updateProject(p.id, { name: n });
  }

  protected setActive(p: Project, e: MatSlideToggleChange): void {
    if (!e.checked && this.store.openShift(p.id)) {
      this.snack.open('יש בפרויקט משמרת פתוחה. יש לסגור אותה לפני העברה ללא פעיל.', 'סגור', {
        duration: 5000,
      });
      e.source.checked = true;
      return;
    }
    this.store.updateProject(p.id, { active: e.checked });
  }

  protected async deleteProject(p: Project): Promise<void> {
    if (this.store.hasRecords(p.id)) return;
    const ok = await this.dialogs.confirm({
      title: 'מחיקת פרויקט',
      message: `למחוק את הפרויקט "${p.name}"?`,
      ok: 'מחיקה',
      danger: true,
    });
    if (ok) this.store.deleteProject(p.id);
  }

  protected sortedRates(p: Project): Rate[] {
    return [...p.rates].sort((a, b) => a.startDate.localeCompare(b.startDate));
  }

  protected addRate(p: Project): void {
    const last = this.sortedRates(p).at(-1);
    this.store.addRate(p.id, { startDate: dateKey(Date.now()), hourly: last?.hourly ?? 0 });
  }

  protected setRateDate(p: Project, r: Rate, v: string): void {
    if (v) this.store.updateRate(p.id, r.id, { startDate: v });
  }

  protected setRateValue(p: Project, r: Rate, v: number | string): void {
    const n = Number(v);
    if (Number.isFinite(n) && n >= 0) this.store.updateRate(p.id, r.id, { hourly: n });
  }

  protected async deleteRate(p: Project, r: Rate): Promise<void> {
    const ok = await this.dialogs.confirm({
      title: 'מחיקת תעריף',
      message: `למחוק את התעריף ₪ ${r.hourly} מ-${r.startDate}? הסכומים יחושבו מחדש.`,
      ok: 'מחיקה',
      danger: true,
    });
    if (ok) this.store.deleteRate(p.id, r.id);
  }

  protected setLongShift(v: number | string): void {
    const n = Number(v);
    if (Number.isFinite(n) && n > 0) this.store.updateSettings({ longShiftHours: n });
  }
}
