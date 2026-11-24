import { DestroyRef, Signal, WritableSignal, inject, signal } from '@angular/core';
import { idbGet, idbPut } from './idb';

/**
 * מצב שנשמר ב-IndexedDB תחת מפתח אחד.
 * - load() נקרא פעם אחת מה-app initializer, לפני הרינדור. אם אין נתונים ב-IndexedDB
 *   אבל יש ב-localStorage (גרסה קודמת) — הם מועברים, ומפתח ה-localStorage נמחק.
 * - mutate() סינכרוני: מחיל את השינוי מיד על ה-signal (התצוגה מתעדכנת),
 *   ובמקביל שומר ברקע: תחת Web Lock בין-לשוניתי קורא מחדש מה-DB, מחיל שוב את אותו שינוי
 *   על הנתונים הטריים וכותב — כדי לא לדרוס שינוי מלשונית אחרת.
 * - אחרי שמירה נשלחת הודעת BroadcastChannel, ולשוניות אחרות טוענות מחדש.
 */
export abstract class PersistedStore<T> {
  private readonly _state: WritableSignal<T>;
  readonly state: Signal<T>;

  private readonly channel: BroadcastChannel;
  private readonly lockName: string;
  /** שמירות ממתינות, בסדר ביצוע. */
  private queue: Promise<void> = Promise.resolve();
  private pending = 0;
  private failed = false;

  protected constructor(
    private readonly key: string,
    private readonly defaults: () => T,
    private readonly normalize: (raw: Partial<T>) => T = (raw) => ({ ...defaults(), ...raw }),
  ) {
    this._state = signal<T>(defaults());
    this.state = this._state.asReadonly();
    this.lockName = `az-man.lock:${key}`;

    this.channel = new BroadcastChannel(`az-man.changed:${key}`);
    // אם יש שמירות ממתינות — הן ממילא יקראו מחדש מה-DB ויעדכנו את ה-signal בסופן
    this.channel.onmessage = () => {
      if (this.pending === 0) void this.reload();
    };
    inject(DestroyRef).onDestroy(() => this.channel.close());
  }

  /** טעינה ראשונית. נכשלת (זורקת) אם IndexedDB לא זמין — כדי לא לעבוד על נתוני ברירת מחדל. */
  async load(): Promise<void> {
    let raw = await idbGet<Partial<T>>(this.key);
    if (raw === undefined) raw = await this.migrateFromLocalStorage();
    this._state.set(this.fromRaw(raw));
  }

  /** החלת השינוי מיד על המצב בזיכרון, ושמירה ברקע. */
  protected mutate<R>(fn: (draft: T) => R): R {
    const draft = structuredClone(this._state());
    const { result, ids } = withIdRecording(() => fn(draft));
    this._state.set(draft);

    this.pending++;
    this.queue = this.queue
      .then(() => this.commit(fn, ids))
      .catch((err) => {
        console.error(`שמירת ${this.key} ב-IndexedDB נכשלה`, err);
        this.failed = true;
      })
      .finally(() => {
        if (--this.pending === 0) {
          // בסוף התור: להציג את מה שבאמת נשמר (כולל שינויים מלשוניות אחרות, או ביטול שינוי שלא נשמר)
          void this.reload();
          if (!this.failed) this.channel.postMessage(null);
          this.failed = false;
        }
      });
    return result;
  }

  private async commit(fn: (draft: T) => unknown, ids: string[]): Promise<void> {
    await navigator.locks.request(this.lockName, async () => {
      const fresh = this.fromRaw(await idbGet<Partial<T>>(this.key));
      withIdReplay(ids, () => fn(fresh));
      await idbPut(this.key, fresh);
    });
  }

  private async reload(): Promise<void> {
    try {
      this._state.set(this.fromRaw(await idbGet<Partial<T>>(this.key)));
    } catch (err) {
      console.error(`טעינת ${this.key} מ-IndexedDB נכשלה`, err);
    }
  }

  private fromRaw(raw: Partial<T> | undefined): T {
    if (raw === undefined) return this.defaults();
    try {
      return this.normalize(raw);
    } catch {
      return this.defaults();
    }
  }

  private async migrateFromLocalStorage(): Promise<Partial<T> | undefined> {
    const text = localStorage.getItem(this.key);
    if (!text) return undefined;
    let raw: Partial<T>;
    try {
      raw = JSON.parse(text);
    } catch {
      return undefined;
    }
    await idbPut(this.key, raw);
    localStorage.removeItem(this.key);
    return raw;
  }
}

// ---------- מזהים יציבים בין ההחלה המיידית להחלה החוזרת בשמירה ----------
// fn של mutate רץ פעמיים (על הזיכרון ועל הנתונים הטריים מה-DB). מזהים שנוצרים בתוכו
// מוקלטים בריצה הראשונה ומושמעים שוב בשנייה, כדי ששתיהן ייצרו אותם מזהים.

let recording: string[] | null = null;
let replay: string[] | null = null;

function withIdRecording<R>(run: () => R): { result: R; ids: string[] } {
  const ids: string[] = [];
  recording = ids;
  try {
    return { result: run(), ids };
  } finally {
    recording = null;
  }
}

function withIdReplay(ids: string[], run: () => unknown): void {
  replay = [...ids];
  try {
    run();
  } finally {
    replay = null;
  }
}

export function newId(): string {
  const replayed = replay?.shift();
  if (replayed) return replayed;
  const id = crypto.randomUUID();
  recording?.push(id);
  return id;
}
