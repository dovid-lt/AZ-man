/**
 * כותב קבצי xlsx מינימלי, ללא תלויות: טקסט, מספרים, תאריכים, שעות, משכים וסכומים,
 * גיליונות מימין לשמאל ורוחב עמודות. הקובץ נארז ב-zip ללא דחיסה.
 */

export type CellStyle = 'date' | 'time' | 'duration' | 'money' | 'number';

export interface Cell {
  v: string | number | null;
  /** סגנון מספרי; לטקסט אין צורך */
  s?: CellStyle;
  bold?: boolean;
}

export type Row = (Cell | string | number | null)[];

export interface Sheet {
  name: string;
  rows: Row[];
  /** רוחב עמודות בתווים */
  widths?: number[];
}

const DAY_MS = 86_400_000;

/** זמן מקומי → מספר סידורי של Excel (ימים מאז 1899-12-30). */
export function excelDate(t: number): number {
  const d = new Date(t);
  const utc = Date.UTC(
    d.getFullYear(),
    d.getMonth(),
    d.getDate(),
    d.getHours(),
    d.getMinutes(),
    d.getSeconds(),
  );
  return utc / DAY_MS + 25569;
}

/** משך במילישניות → שבר של יום (לתצוגה בפורמט [h]:mm). */
export function excelDuration(ms: number): number {
  return Math.floor(ms / 1000) / 86_400;
}

// ---------- סגנונות ----------

const STYLE_ORDER: (CellStyle | undefined)[] = [
  undefined,
  'date',
  'time',
  'duration',
  'money',
  'number',
];
const NUM_FMT: Record<CellStyle, number> = {
  date: 164,
  time: 165,
  duration: 166,
  money: 167,
  number: 2,
};

function styleIndex(c: Cell): number {
  return STYLE_ORDER.indexOf(c.s) + (c.bold ? STYLE_ORDER.length : 0);
}

function stylesXml(): string {
  const xf = (bold: boolean) =>
    STYLE_ORDER.map((s) => {
      const fmt = s ? NUM_FMT[s] : 0;
      return `<xf numFmtId="${fmt}" fontId="${bold ? 1 : 0}" fillId="0" borderId="0" xfId="0"${fmt ? ' applyNumberFormat="1"' : ''}${bold ? ' applyFont="1"' : ''}/>`;
    }).join('');
  return (
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">` +
    `<numFmts count="4">` +
    `<numFmt numFmtId="164" formatCode="dd/mm/yyyy"/>` +
    `<numFmt numFmtId="165" formatCode="hh:mm"/>` +
    `<numFmt numFmtId="166" formatCode="[h]:mm"/>` +
    `<numFmt numFmtId="167" formatCode="&quot;₪&quot;\\ #,##0.00"/>` +
    `</numFmts>` +
    `<fonts count="2"><font><sz val="11"/><name val="Arial"/></font><font><b/><sz val="11"/><name val="Arial"/></font></fonts>` +
    `<fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills>` +
    `<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>` +
    `<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>` +
    `<cellXfs count="${STYLE_ORDER.length * 2}">${xf(false)}${xf(true)}</cellXfs>` +
    `<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>` +
    `</styleSheet>`
  );
}

// ---------- גיליונות ----------

const esc = (s: string) =>
  s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    // תווי בקרה אסורים ב-XML
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '');

function colName(i: number): string {
  let s = '';
  for (i++; i > 0; i = Math.floor((i - 1) / 26)) s = String.fromCharCode(65 + ((i - 1) % 26)) + s;
  return s;
}

function toCell(c: Cell | string | number | null): Cell {
  return c != null && typeof c === 'object' ? c : { v: c };
}

function sheetXml(sheet: Sheet): string {
  const rows = sheet.rows
    .map((row, r) => {
      const cells = row
        .map((raw, c) => {
          const cell = toCell(raw);
          if (cell.v == null || cell.v === '')
            return cell.bold ? `<c r="${colName(c)}${r + 1}" s="${styleIndex(cell)}"/>` : '';
          const ref = `${colName(c)}${r + 1}`;
          const s = styleIndex(cell);
          const sAttr = s ? ` s="${s}"` : '';
          return typeof cell.v === 'number'
            ? `<c r="${ref}"${sAttr}><v>${cell.v}</v></c>`
            : `<c r="${ref}"${sAttr} t="inlineStr"><is><t xml:space="preserve">${esc(cell.v)}</t></is></c>`;
        })
        .join('');
      return `<row r="${r + 1}">${cells}</row>`;
    })
    .join('');
  const cols = sheet.widths?.length
    ? `<cols>${sheet.widths.map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`).join('')}</cols>`
    : '';
  return (
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">` +
    `<sheetViews><sheetView rightToLeft="1" workbookViewId="0"/></sheetViews>` +
    cols +
    `<sheetData>${rows}</sheetData>` +
    `</worksheet>`
  );
}

/** שם גיליון חוקי: עד 31 תווים, בלי []:*?/\ */
function sheetName(name: string): string {
  return name.replace(/[[\]:*?/\\]/g, ' ').slice(0, 31) || 'Sheet';
}

export function buildXlsx(sheets: Sheet[]): Blob {
  const files: [string, string][] = [
    [
      '[Content_Types].xml',
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
        `<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">` +
        `<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>` +
        `<Default Extension="xml" ContentType="application/xml"/>` +
        `<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>` +
        `<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>` +
        sheets
          .map(
            (_, i) =>
              `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`,
          )
          .join('') +
        `</Types>`,
    ],
    [
      '_rels/.rels',
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
        `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
        `<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>` +
        `</Relationships>`,
    ],
    [
      'xl/workbook.xml',
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
        `<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">` +
        `<sheets>${sheets.map((s, i) => `<sheet name="${esc(sheetName(s.name))}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join('')}</sheets>` +
        `</workbook>`,
    ],
    [
      'xl/_rels/workbook.xml.rels',
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
        `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
        sheets
          .map(
            (_, i) =>
              `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`,
          )
          .join('') +
        `<Relationship Id="rId${sheets.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>` +
        `</Relationships>`,
    ],
    ['xl/styles.xml', stylesXml()],
    ...sheets.map((s, i): [string, string] => [`xl/worksheets/sheet${i + 1}.xml`, sheetXml(s)]),
  ];
  return new Blob([zip(files) as BlobPart], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
}

// ---------- zip (stored) ----------

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(data: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < data.length; i++) c = CRC_TABLE[(c ^ data[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function zip(files: [string, string][]): Uint8Array {
  const enc = new TextEncoder();
  const now = new Date();
  const dosTime = (now.getHours() << 11) | (now.getMinutes() << 5) | (now.getSeconds() >> 1);
  const dosDate = ((now.getFullYear() - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate();

  const locals: Uint8Array[] = [];
  const centrals: Uint8Array[] = [];
  let offset = 0;

  for (const [name, content] of files) {
    const nameBytes = enc.encode(name);
    const data = enc.encode(content);
    const crc = crc32(data);

    const local = new Uint8Array(30 + nameBytes.length + data.length);
    const lv = new DataView(local.buffer);
    lv.setUint32(0, 0x04034b50, true);
    lv.setUint16(4, 20, true);
    lv.setUint16(6, 0x0800, true); // UTF-8
    lv.setUint16(8, 0, true); // stored
    lv.setUint16(10, dosTime, true);
    lv.setUint16(12, dosDate, true);
    lv.setUint32(14, crc, true);
    lv.setUint32(18, data.length, true);
    lv.setUint32(22, data.length, true);
    lv.setUint16(26, nameBytes.length, true);
    lv.setUint16(28, 0, true);
    local.set(nameBytes, 30);
    local.set(data, 30 + nameBytes.length);
    locals.push(local);

    const central = new Uint8Array(46 + nameBytes.length);
    const cv = new DataView(central.buffer);
    cv.setUint32(0, 0x02014b50, true);
    cv.setUint16(4, 20, true);
    cv.setUint16(6, 20, true);
    cv.setUint16(8, 0x0800, true);
    cv.setUint16(10, 0, true);
    cv.setUint16(12, dosTime, true);
    cv.setUint16(14, dosDate, true);
    cv.setUint32(16, crc, true);
    cv.setUint32(20, data.length, true);
    cv.setUint32(24, data.length, true);
    cv.setUint16(28, nameBytes.length, true);
    cv.setUint32(42, offset, true);
    central.set(nameBytes, 46);
    centrals.push(central);

    offset += local.length;
  }

  const centralSize = centrals.reduce((n, c) => n + c.length, 0);
  const end = new Uint8Array(22);
  const ev = new DataView(end.buffer);
  ev.setUint32(0, 0x06054b50, true);
  ev.setUint16(8, files.length, true);
  ev.setUint16(10, files.length, true);
  ev.setUint32(12, centralSize, true);
  ev.setUint32(16, offset, true);

  const out = new Uint8Array(offset + centralSize + end.length);
  let p = 0;
  for (const part of [...locals, ...centrals, end]) {
    out.set(part, p);
    p += part.length;
  }
  return out;
}

/** הורדת Blob כקובץ. */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
