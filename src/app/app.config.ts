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
  ],
};
