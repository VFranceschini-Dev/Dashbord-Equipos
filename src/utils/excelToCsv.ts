// Utilidades de conversión Excel -> CSV y parsing/normalización de CSV.
// Todo ocurre en el cliente, apenas se selecciona el archivo.

import * as XLSX from 'xlsx';

export interface SheetRow {
  [header: string]: string;
}

export interface ParsedCsv {
  headers: string[];
  rows: SheetRow[];
}

/** Lee las hojas del Excel (primera hoja por defecto). */
export async function readWorkbook(file: File): Promise<XLSX.WorkBook> {
  const buffer = await file.arrayBuffer();
  return XLSX.read(buffer, { type: 'array', cellDates: true });
}

export function sheetNames(wb: XLSX.WorkBook): string[] {
  return wb.SheetNames ?? [];
}

/** Convierte una hoja a matriz de strings sin perder ceros ni tipos. */
function sheetToArray(wb: XLSX.WorkBook, sheetName: string): string[][] {
  const ws = wb.Sheets[sheetName];
  if (!ws) throw new Error('No se pudo leer la hoja seleccionada.');
  // raw: false => formatea según el número de formato (fechas como texto legible,
  // Códigos/CUIT conservan ceros a la izquierda porque se leen como string).
  const array = XLSX.utils.sheet_to_json<string[]>(ws, {
    header: 1,
    raw: false,
    defval: '',
    blankrows: false,
  });
  return array.map((row) => row.map((cell) => normalizeCell(String(cell ?? ''))));
}

/** Quita espacios sobradores y normaliza saltos de línea internos. */
function normalizeCell(value: string): string {
  return value.replace(/\r\n?/g, '\n').replace(/[ \t]+/g, ' ').trim();
}

/** Normaliza un encabezado a minúsculas, sin tildes ni espacios (solo guiones bajos). */
export function normalizeHeader(header: string): string {
  return header
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

/** Genera un CSV UTF-8 (coma como separador, comillas dobles RFC4180). */
export function toCsv(headers: string[], rows: string[][]): string {
  const escape = (value: string): string => {
    if (/[",\n]/.test(value)) {
      return `"${value.replace(/"/g, '""')}"`;
    }
    return value;
  };
  const lines = [headers, ...rows].map((row) => row.map(escape).join(','));
  return lines.join('\n');
}

/** Convierte una hoja del workbook a { headers, rows }. */
export function sheetToData(wb: XLSX.WorkBook, sheetName: string): { headers: string[]; rows: string[][] } {
  const array = sheetToArray(wb, sheetName);
  if (array.length === 0) throw new Error('La hoja está vacía.');
  const headers = array[0].map((h) => normalizeHeader(h)).filter((h) => h !== '');
  if (headers.length === 0) throw new Error('La primera fila debe contener los encabezados.');
  const rows = array
    .slice(1)
    .map((row) => {
      const normalized = [...row];
      while (normalized.length < headers.length) normalized.push('');
      return normalized.slice(0, headers.length);
    })
    .filter((row) => row.some((cell) => cell !== '')); // descarta filas vacías
  return { headers, rows };
}

/** Parsing simple de CSV (coma, comillas dobles RFC4180). */
export function parseCsv(csv: string): ParsedCsv {
  const content = csv.startsWith('\uFEFF') ? csv.slice(1) : csv;
  const records: string[][] = [];
  let field = '';
  let record: string[] = [];
  let inQuotes = false;

  for (let i = 0; i < content.length; i++) {
    const char = content[i];
    if (inQuotes) {
      if (char === '"') {
        if (content[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += char;
      }
    } else if (char === '"') {
      inQuotes = true;
    } else if (char === ',') {
      record.push(field);
      field = '';
    } else if (char === '\n' || char === '\r') {
      if (char === '\r' && content[i + 1] === '\n') i++;
      record.push(field);
      field = '';
      records.push(record);
      record = [];
    } else {
      field += char;
    }
  }
  if (field !== '' || record.length > 0) {
    record.push(field);
    records.push(record);
  }

  const nonEmpty = records.filter((r) => r.some((c) => c.trim() !== ''));
  if (nonEmpty.length === 0) return { headers: [], rows: [] };
  const headers = nonEmpty[0].map((h) => normalizeHeader(h));
  const rows = nonEmpty.slice(1).map((r) => {
    const obj: SheetRow = {};
    headers.forEach((h, idx) => {
      obj[h] = (r[idx] ?? '').trim();
    });
    return obj;
  });
  return { headers, rows };
}

/** Pasa fechas a YYYY-MM-DD HH:mm:ss. Devuelve null si no es fecha válida. */
export function toSqlDateTime(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;

  // Ya viene en formato ISO o similar AAAA-MM-DD...
  const isoMatch = trimmed.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})(?:[T ](\d{1,2}):(\d{2})(?::(\d{2}))?)?$/);
  if (isoMatch) {
    const [, y, mo, d, h = '00', mi = '00', s = '00'] = isoMatch;
    return `${y}-${mo.padStart(2, '0')}-${d.padStart(2, '0')} ${h.padStart(2, '0')}:${mi}:${s}`;
  }

  // Formato argentino DD/MM/YYYY (con o sin hora)
  const arMatch = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?$/);
  if (arMatch) {
    const [, d, mo, y, h = '00', mi = '00', s = '00'] = arMatch;
    return `${y}-${mo.padStart(2, '0')}-${d.padStart(2, '0')} ${h.padStart(2, '0')}:${mi}:${s}`;
  }

  const date = new Date(trimmed);
  if (!Number.isNaN(date.getTime())) {
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
  }
  return null;
}

/** Descarta ceros a la izquierda perdidos / mantiene identificadores como texto. */
export function keepAsText(value: string): string {
  return value.trim();
}

/** Normaliza un nombre para comparar: mayúsculas, sin tildes, espacios colapsados. */
export function normalizeName(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/** Dispara la descarga de un archivo de texto en el navegador. */
export function downloadTextFile(filename: string, content: string, mime = 'text/csv;charset=utf-8'): void {
  const blob = new Blob(['\uFEFF' + content], { type: mime });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
