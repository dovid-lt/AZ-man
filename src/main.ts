import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { App } from './app/app';

bootstrapApplication(App, appConfig).catch((err) => {
  console.error(err);
  document.body.textContent = 'שגיאה בהפעלת היישום (ייתכן שאחסון הדפדפן אינו זמין). פרטים ב-Console.';
});
