import { DestroyRef, Injectable, inject, signal } from '@angular/core';

/**
 * שעון חי: מתעדכן פעם בשנייה. הערך הוא תמיד Date.now() ולא ספירת tick,
 * כך שאין סטייה מצטברת כשהלשונית ברקע.
 */
@Injectable({ providedIn: 'root' })
export class ClockService {
  private readonly _now = signal(Date.now());
  readonly now = this._now.asReadonly();

  constructor() {
    const id = setInterval(() => this._now.set(Date.now()), 1000);
    const onVisible = () => this._now.set(Date.now());
    document.addEventListener('visibilitychange', onVisible);
    inject(DestroyRef).onDestroy(() => {
      clearInterval(id);
      document.removeEventListener('visibilitychange', onVisible);
    });
  }
}
