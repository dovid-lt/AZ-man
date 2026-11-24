import { Injectable, computed } from '@angular/core';
import { Id, ProjectFilter, ReportParams, UiState } from './models';
import { PersistedStore } from './persisted-store';
import { dateKey } from './time';

const KEY = 'az-man.ui.v1';

const defaults = (): UiState => {
  const today = dateKey(Date.now());
  return {
    currentProjectId: null,
    dashboardProjects: null,
    report: { kind: 'month', anchor: today, from: today, to: today, projects: null },
  };
};

/** זיכרון מצב: פרויקט נוכחי, סינון הדשבורד ופרמטרי הדוח. */
@Injectable({ providedIn: 'root' })
export class UiStore extends PersistedStore<UiState> {
  readonly currentProjectId = computed(() => this.state().currentProjectId);
  readonly dashboardProjects = computed(() => this.state().dashboardProjects);
  readonly report = computed(() => this.state().report);

  constructor() {
    super(KEY, defaults, (raw) => {
      const d = defaults();
      return { ...d, ...raw, report: { ...d.report, ...raw.report } };
    });
  }

  setCurrentProject(id: Id | null): void {
    this.mutate((s) => (s.currentProjectId = id));
  }

  setDashboardProjects(f: ProjectFilter): void {
    this.mutate((s) => (s.dashboardProjects = f));
  }

  setReport(patch: Partial<ReportParams>): void {
    this.mutate((s) => Object.assign(s.report, patch));
  }
}
