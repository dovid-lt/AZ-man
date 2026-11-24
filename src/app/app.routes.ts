import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () => import('./features/home/home.page').then((m) => m.HomePage),
    title: 'שעות עבודה',
  },
  {
    path: 'reports',
    loadComponent: () => import('./features/reports/reports.page').then((m) => m.ReportsPage),
    title: 'דוחות — שעות עבודה',
  },
  {
    path: 'settings',
    loadComponent: () => import('./features/settings/settings.page').then((m) => m.SettingsPage),
    title: 'הגדרות — שעות עבודה',
  },
  {
    path: 'about',
    loadComponent: () => import('./features/about/about.page').then((m) => m.AboutPage),
    title: 'אודות ועזרה — שעות עבודה',
  },
  { path: '**', redirectTo: '' },
];
