import { DestroyRef, Signal, WritableSignal, inject, signal } from '@angular/core';

/**
 * מצב שנשמר ב-localStorage תחת מפתח אחד.
 * - כל כתיבה קוראת קודם מחדש מ-localStorage, כדי לא לדרוס שינוי מלשונית אחרת.
 * - אירוע storage מלשונית אחרת טוען מחדש את המצב (והתצוגה מתרנדרת דרך ה-signal).
 */
export abstract class PersistedStore<T> {
  private readonly _state: WritableSignal<T>;
  readonly state: Signal<T>;

  protected constructor(
    private readonly key: string,
    private readonly defaults: () => T,
    private readonly normalize: (raw: Partial<T>) => T = (raw) => ({ ...defaults(), ...raw }),
  ) {
    this._state = signal<T>(this.read());
    this.state = this._state.asReadonly();

    const onStorage = (e: StorageEvent) => {
      if (e.key === this.key || e.key === null) this._state.set(this.read());
    };
    window.addEventListener('storage', onStorage);
    inject(DestroyRef).onDestroy(() => window.removeEventListener('storage', onStorage));
  }

  private read(): T {
    try {
      const raw = localStorage.getItem(this.key);
      return raw ? this.normalize(JSON.parse(raw)) : this.defaults();
    } catch {
      return this.defaults();
    }
  }

  /** קריאה טרייה, החלת השינוי, כתיבה ועדכון ה-signal. */
  protected mutate<R>(fn: (draft: T) => R): R {
    const draft = this.read();
    const result = fn(draft);
    localStorage.setItem(this.key, JSON.stringify(draft));
    this._state.set(draft);
    return result;
  }
}

export function newId(): string {
  return crypto.randomUUID();
}
