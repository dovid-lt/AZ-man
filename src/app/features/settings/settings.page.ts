import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSlideToggleChange, MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatTooltip } from '@angular/material/tooltip';
import { DataStore } from '../../core/data.store';
import { FIRST_RATE_DATE, Project } from '../../core/models';
import { parseDateKey, shortDate } from '../../core/time';
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

  protected async addProject(): Promise<void> {
    const res = await this.dialogs.newProject();
    if (res) this.store.addProject(res.name, res.hourly);
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

  /**
   * שדה התעריף היחיד. אין תעריף בתוקף — נוצר תעריף ראשון שחל על כל השעות.
   * יש תעריף — נפתח חלון: מהיום / מתאריך אחר / תיקון התעריף הקיים.
   */
  protected async changeRate(p: Project, input: HTMLInputElement): Promise<void> {
    const cur = this.store.currentRate(p.id);
    const n = Number(input.value);
    if (input.value.trim() !== '' && Number.isFinite(n) && n >= 0) {
      if (!cur) {
        this.store.setRate(p.id, FIRST_RATE_DATE, n);
      } else if (n !== cur.hourly) {
        const res = await this.dialogs.rateChange({
          projectName: p.name,
          oldHourly: cur.hourly,
          newHourly: n,
          currentStart: cur.startDate,
        });
        if (res?.mode === 'fix') this.store.updateRate(p.id, cur.id, { hourly: n });
        else if (res) this.store.setRate(p.id, res.date, n);
      }
    }
    // ה-binding לא מתעדכן כשהערך בתוקף לא השתנה (ביטול, תעריף עתידי) — מסנכרנים ידנית.
    input.value = String(this.store.currentRate(p.id)?.hourly ?? '');
  }

  protected rateHistory(p: Project): void {
    this.dialogs.rateHistory(p.id);
  }

  protected dateLabel(key: string): string {
    return shortDate(parseDateKey(key));
  }

  protected setLongShift(v: number | string): void {
    const n = Number(v);
    if (Number.isFinite(n) && n > 0) this.store.updateSettings({ longShiftHours: n });
  }
}
