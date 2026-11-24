import { Injectable, computed } from '@angular/core';
import { AppData, Id, Project, Rate, Settings, Shift, isOpen, recordTime } from './models';
import { PersistedStore, newId } from './persisted-store';
import { dateKey } from './time';

const KEY = 'az-man.data.v1';

/** מזהה קבוע: עד הכתיבה הראשונה כל read() מחזיר defaults() חדש, ו-id אקראי היה משתנה בין קריאות. */
const DEFAULT_PROJECT_ID = 'default';

const defaults = (): AppData => ({
  version: 1,
  projects: [{ id: DEFAULT_PROJECT_ID, name: 'כללי', active: true, rates: [] }],
  shifts: [],
  settings: { longShiftHours: 12 },
});

@Injectable({ providedIn: 'root' })
export class DataStore extends PersistedStore<AppData> {
  readonly projects = computed(() => this.state().projects);
  readonly activeProjects = computed(() => this.projects().filter((p) => p.active));
  readonly shifts = computed(() => this.state().shifts);
  readonly settings = computed(() => this.state().settings);
  readonly openShifts = computed(() => this.shifts().filter(isOpen));

  constructor() {
    super(KEY, defaults, (raw) => {
      const d = defaults();
      return {
        version: 1,
        projects: raw.projects ?? d.projects,
        shifts: raw.shifts ?? d.shifts,
        settings: { ...d.settings, ...raw.settings },
      };
    });
  }

  // ---------- שאילתות ----------

  project(id: Id | null | undefined): Project | undefined {
    return this.projects().find((p) => p.id === id);
  }

  projectName(id: Id): string {
    return this.project(id)?.name ?? '(פרויקט נמחק)';
  }

  shift(id: Id): Shift | undefined {
    return this.shifts().find((s) => s.id === id);
  }

  openShift(projectId: Id): Shift | undefined {
    return this.shifts().find((s) => s.projectId === projectId && isOpen(s));
  }

  hasRecords(projectId: Id): boolean {
    return this.shifts().some((s) => s.projectId === projectId);
  }

  /** זמן הרשומה האחרונה בפרויקט (לבדיקת עקביות של שעה שהוזנה). */
  lastRecordTime(projectId: Id, excludeId?: Id): number | null {
    let max: number | null = null;
    for (const s of this.shifts()) {
      if (s.projectId !== projectId || s.id === excludeId) continue;
      const t = recordTime(s);
      if (max == null || t > max) max = t;
    }
    return max;
  }

  /** התעריף שבתוקף היום (תאריך ההתחלה האחרון שכבר הגיע). */
  currentRate(projectId: Id, today = dateKey(Date.now())): Rate | undefined {
    let cur: Rate | undefined;
    for (const r of this.project(projectId)?.rates ?? []) {
      if (r.startDate <= today && (!cur || r.startDate > cur.startDate)) cur = r;
    }
    return cur;
  }

  /** התעריף העתידי הקרוב, אם הוגדר. */
  nextRate(projectId: Id, today = dateKey(Date.now())): Rate | undefined {
    let next: Rate | undefined;
    for (const r of this.project(projectId)?.rates ?? []) {
      if (r.startDate > today && (!next || r.startDate < next.startDate)) next = r;
    }
    return next;
  }

  // ---------- פרויקטים ----------

  addProject(name: string): Id {
    const id = newId();
    this.mutate((d) => d.projects.push({ id, name: name.trim(), active: true, rates: [] }));
    return id;
  }

  updateProject(id: Id, patch: Partial<Pick<Project, 'name' | 'active'>>): void {
    this.mutate((d) => {
      const p = d.projects.find((x) => x.id === id);
      if (p) Object.assign(p, patch);
    });
  }

  /** מחיקה מותרת רק לפרויקט ללא רשומות. */
  deleteProject(id: Id): boolean {
    return this.mutate((d) => {
      if (d.shifts.some((s) => s.projectId === id)) return false;
      d.projects = d.projects.filter((p) => p.id !== id);
      return true;
    });
  }

  addRate(projectId: Id, rate: Omit<Rate, 'id'>): void {
    this.mutate((d) =>
      d.projects.find((p) => p.id === projectId)?.rates.push({ id: newId(), ...rate }),
    );
  }

  /** תעריף מתאריך. אם כבר יש תעריף שמתחיל באותו תאריך — הוא מתעדכן במקום להוסיף שורה. */
  setRate(projectId: Id, startDate: string, hourly: number): void {
    this.mutate((d) => {
      const p = d.projects.find((x) => x.id === projectId);
      if (!p) return;
      const same = p.rates.find((r) => r.startDate === startDate);
      if (same) same.hourly = hourly;
      else p.rates.push({ id: newId(), startDate, hourly });
    });
  }

  updateRate(projectId: Id, rateId: Id, patch: Partial<Omit<Rate, 'id'>>): void {
    this.mutate((d) => {
      const r = d.projects.find((p) => p.id === projectId)?.rates.find((x) => x.id === rateId);
      if (r) Object.assign(r, patch);
    });
  }

  deleteRate(projectId: Id, rateId: Id): void {
    this.mutate((d) => {
      const p = d.projects.find((x) => x.id === projectId);
      if (p) p.rates = p.rates.filter((r) => r.id !== rateId);
    });
  }

  // ---------- משמרות ----------

  addShift(s: Omit<Shift, 'id' | 'note' | 'broken'> & Partial<Pick<Shift, 'note' | 'broken'>>): Id {
    const id = newId();
    this.mutate((d) => d.shifts.push({ note: '', broken: false, ...s, id }));
    return id;
  }

  updateShift(id: Id, patch: Partial<Omit<Shift, 'id'>>): void {
    this.mutate((d) => {
      const s = d.shifts.find((x) => x.id === id);
      if (s) Object.assign(s, patch);
    });
  }

  deleteShift(id: Id): void {
    this.mutate((d) => (d.shifts = d.shifts.filter((s) => s.id !== id)));
  }

  /** צימוד שתי רשומות שבורות (כניסה + יציאה) למשמרת אחת. */
  pairBroken(inId: Id, outId: Id): void {
    this.mutate((d) => {
      const a = d.shifts.find((s) => s.id === inId);
      const b = d.shifts.find((s) => s.id === outId);
      if (!a || !b) return;
      a.end = b.end;
      a.broken = false;
      if (b.note) a.note = a.note ? `${a.note} | ${b.note}` : b.note;
      d.shifts = d.shifts.filter((s) => s.id !== outId);
    });
  }

  /**
   * סגירת משמרת פתוחה עם פיצול ב-00:00: כל יום קלנדרי נשמר כמשמרת נפרדת.
   * parts הם נקודות החצות שבין הכניסה ליציאה.
   */
  closeSplit(id: Id, end: number, midnights: number[]): void {
    this.mutate((d) => {
      const s = d.shifts.find((x) => x.id === id);
      if (!s || s.start == null) return;
      const bounds = [s.start, ...midnights, end];
      s.end = bounds[1];
      for (let i = 1; i < bounds.length - 1; i++) {
        d.shifts.push({
          id: newId(),
          projectId: s.projectId,
          start: bounds[i],
          end: bounds[i + 1],
          broken: false,
          note: '',
        });
      }
    });
  }

  updateSettings(patch: Partial<Settings>): void {
    this.mutate((d) => Object.assign(d.settings, patch));
  }
}
