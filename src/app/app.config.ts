import {
  ApplicationConfig,
  inject,
  provideAppInitializer,
  provideBrowserGlobalErrorListeners,
} from '@angular/core';
import { MAT_DIALOG_DEFAULT_OPTIONS } from '@angular/material/dialog';
import { MatIconRegistry } from '@angular/material/icon';
import { provideRouter, withHashLocation } from '@angular/router';
import { routes } from './app.routes';
import { DataStore } from './core/data.store';
import { UiStore } from './core/ui.store';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    // ניתוב hash: עובד על כל שרת סטטי בלי הגדרת rewrite
    provideRouter(routes, withHashLocation()),
    {
      provide: MAT_DIALOG_DEFAULT_OPTIONS,
      useValue: { direction: 'rtl', autoFocus: 'first-tabbable', restoreFocus: true },
    },
    // אייקונים מקומיים מחבילת material-symbols (נארזים בבילד)
    provideAppInitializer(() => {
      inject(MatIconRegistry).setDefaultFontSetClass('material-symbols-outlined');
    }),
    // טעינת הנתונים מ-IndexedDB לפני הרינדור הראשון
    provideAppInitializer(() => {
      // בקשה שהדפדפן לא ימחק את הנתונים כשנגמר מקום (בכרום — אישור לפי היוריסטיקה, בלי חלון)
      void navigator.storage?.persist?.();
      return Promise.all([inject(DataStore).load(), inject(UiStore).load()]);
    }),
  ],
};
