# AZ-man (הז-מן) — ניהול שעות עבודה

יישום צד לקוח (Angular 22, Angular Material) לתיעוד שעות עבודה לפי פרויקטים וחישוב הסכום לתשלום.
האפיון: [`docs/אפיון.md`](docs/אפיון.md).

## פקודות

```bash
npm install          # התקנת תלויות
npm start            # שרת פיתוח: http://localhost:4200
npm run build        # בילד לייצור: dist/az-man/browser
npm test             # בדיקות יחידה (Vitest)
npm run cf:dev       # בילד + הרצה מקומית ב-Cloudflare (wrangler dev)
npm run cf:deploy    # בילד + פריסה ל-Cloudflare Workers
```

## פריסה

תוכן `dist/az-man/browser` הוא אתר סטטי. אפשר להגיש אותו מכל שרת סטטי (IIS, nginx וכו').
הניתוב מבוסס hash (`#/reports`), ולכן לא צריך הגדרת rewrite בשרת.
אם מגישים מתת-תיקייה, בונים עם `ng build --base-href /path/`.

הפריסה הנוכחית היא ל-Cloudflare Workers ([`wrangler.jsonc`](wrangler.jsonc)): הקבצים הסטטיים מוגשים ישירות,
ורק `/api/*` מגיע ל-Worker ([`worker/index.ts`](worker/index.ts)). כרגע יש בו רק `/api/health`, והיישום לא משתמש בו.

אין טעינה מהרשת בזמן ריצה: הפונטים הם פונטים של המערכת (Segoe UI), והאייקונים
(Material Symbols) נארזים בבילד מחבילת `material-symbols`.

## מבנה

```
src/app/
  core/                  לוגיקה ללא UI
    models.ts            מודל הנתונים (פרויקט, תעריף, משמרת, מצב UI)
    idb.ts               עטיפה מינימלית ל-IndexedDB (מסד az-man, store אחד kv)
    persisted-store.ts   בסיס ל-store ב-IndexedDB: עדכון מיידי בזיכרון, שמירה ברקע תחת Web Lock עם קריאה מחדש + סנכרון בין לשוניות (BroadcastChannel)
    data.store.ts        פרויקטים, תעריפים, משמרות, הגדרות
    ui.store.ts          זיכרון מצב: פרויקט נוכחי, סינון דשבורד, פרמטרי דוח
    calc.ts              תמחור: פיצול לפי חצות ותעריף, זמן ללא תעריף, סיכומים
    summary.ts           סיכום טווח (סה"כ, לפי פרויקט/יום, רשומות שבורות)
    punch.service.ts     כניסה/יציאה ובדיקת העקביות (מקרי הקצה שבאפיון)
    clock.service.ts     שעון חי (Date.now() פעם בשנייה)
    time.ts              תאריכים, תאריך עברי, פורמטים
    xlsx.ts              כתיבת קובץ xlsx ללא תלויות (ייצוא דוח לאקסל)
  features/
    home/                אזור פעולה + דשבורד
    reports/             דוחות
    settings/            ניהול פרויקטים ותעריפים, סף משמרת ארוכה
    about/               אודות ועזרה
  layout/                התראת משמרת ארוכה
  shared/
    dialogs/             כל החלונות + DialogService
    ...                  pipes, בורר פרויקטים, תווית יום
worker/                  Cloudflare Worker (רק /api/*)
```

## מודל המשמרת

כל רשומה היא `Shift` עם `start` ו-`end` (אחד מהם יכול להיות ריק):

| מצב    | start | end | broken |
|--------|-------|-----|--------|
| שלמה   | ✓     | ✓   | false  |
| פתוחה  | ✓     | —   | false  |
| שבורה  | ✓ או — | — או ✓ | true |

סכומים לא נשמרים. הם מחושבים בכל תצוגה, כך ששינוי תעריף רטרואקטיבי מתעדכן מיד.

## אחסון

מסד IndexedDB בשם `az-man`, object store `kv`, שני מפתחות: `az-man.data.v1` (נתונים) ו-`az-man.ui.v1` (זיכרון מצב). בטעינה הראשונה נתונים קיימים מ-localStorage (אותם מפתחות) מועברים ל-IndexedDB ונמחקים מ-localStorage.
