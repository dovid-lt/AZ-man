import { Injectable, inject } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { DialogService } from '../shared/dialogs/dialog.service';
import { DataStore } from './data.store';
import { Id } from './models';
import { hm, nextMidnight, sameDay, shortDate } from './time';

export type Direction = 'in' | 'out';

/** נקודות החצות שבין s ל-e (לא כולל הקצוות). */
export function midnightsBetween(s: number, e: number): number[] {
  const out: number[] = [];
  for (let m = nextMidnight(s); m < e; m = nextMidnight(m)) out.push(m);
  return out;
}

/**
 * רישום כניסה ויציאה עם בדיקת העקביות שבאפיון.
 * העקביות נבדקת לכל פרויקט בנפרד.
 */
@Injectable({ providedIn: 'root' })
export class PunchService {
  private readonly store = inject(DataStore);
  private readonly dialogs = inject(DialogService);
  private readonly snack = inject(MatSnackBar);

  /** הפעולה הצפויה לפי מצב הפרויקט. */
  expected(projectId: Id): Direction {
    return this.store.openShift(projectId) ? 'out' : 'in';
  }

  punch(projectId: Id, dir: Direction, at = Date.now()): Promise<boolean> {
    return dir === 'in' ? this.punchIn(projectId, at) : this.punchOut(projectId, at);
  }

  /** מקרה 1: כניסה כשכבר יש כניסה פתוחה. */
  async punchIn(projectId: Id, at = Date.now()): Promise<boolean> {
    const name = this.store.projectName(projectId);
    const open = this.store.openShift(projectId);
    if (open) {
      const t = await this.dialogs.promptTime({
        title: 'חסרה יציאה',
        message:
          `בפרויקט "${name}" יש כניסה פתוחה מ-${shortDate(open.start!)} ${hm(open.start!)}. ` +
          'מתי הייתה היציאה? סגירת החלון בלי תשובה תשאיר את הכניסה הקודמת כרשומה שבורה.',
        label: 'שעת היציאה החסרה',
        min: open.start,
        max: at,
        initial: at,
      });
      if (t != null) this.store.updateShift(open.id, { end: t });
      else this.store.updateShift(open.id, { broken: true });
    }
    this.store.addShift({ projectId, start: at, end: null });
    this.notify(`נרשמה כניסה ל"${name}" ב-${hm(at)}`);
    return true;
  }

  /** מקרים 2 ו-3: יציאה בלי כניסה פתוחה, ויציאה מכניסה של יום קודם. */
  async punchOut(projectId: Id, at = Date.now()): Promise<boolean> {
    const name = this.store.projectName(projectId);
    const open = this.store.openShift(projectId);

    if (!open) {
      const t = await this.dialogs.promptTime({
        title: 'חסרה כניסה',
        message:
          `בפרויקט "${name}" אין כניסה פתוחה. מתי הייתה הכניסה? ` +
          'סגירת החלון בלי תשובה תשמור את היציאה כרשומה שבורה.',
        label: 'שעת הכניסה',
        min: this.store.lastRecordTime(projectId),
        max: at,
        initial: at,
      });
      if (t != null) {
        this.store.addShift({ projectId, start: t, end: at });
        this.notify(`נרשמה משמרת ב"${name}" ${hm(t)}–${hm(at)}`);
      } else {
        this.store.addShift({ projectId, start: null, end: at, broken: true });
        this.notify(`היציאה נשמרה כרשומה שבורה`);
      }
      return true;
    }

    if (!sameDay(open.start!, at)) {
      const choice = await this.dialogs.midnight({
        projectName: name,
        start: open.start!,
        end: at,
      });
      if (choice === 'same') {
        this.store.closeSplit(open.id, at, midnightsBetween(open.start!, at));
        this.notify(`המשמרת נסגרה ופוצלה לפי ימים`);
        return true;
      }
      if (choice === 'separate') {
        this.store.updateShift(open.id, { broken: true });
        this.store.addShift({ projectId, start: null, end: at, broken: true });
        this.notify(`הכניסה והיציאה נשמרו כרשומות שבורות`);
        return true;
      }
      return false;
    }

    this.store.updateShift(open.id, { end: at });
    this.notify(`נרשמה יציאה מ"${name}" ב-${hm(at)}`);
    return true;
  }

  /** תיקון שעת יציאה למשמרת פתוחה (מהתראת משמרת ארוכה). */
  async fixOpenExit(shiftId: Id): Promise<void> {
    const s = this.store.shift(shiftId);
    if (!s || s.start == null) return;
    const now = Date.now();
    const t = await this.dialogs.promptTime({
      title: 'תיקון שעת יציאה',
      message: `משמרת ב"${this.store.projectName(s.projectId)}" פתוחה מ-${shortDate(s.start)} ${hm(s.start)}.`,
      label: 'שעת היציאה',
      min: s.start,
      max: now,
      initial: now,
    });
    if (t != null) await this.punchOut(s.projectId, t);
  }

  private notify(msg: string): void {
    this.snack.open(msg, 'סגור', { duration: 3500 });
  }
}
