export interface ImportResult<T> {
  data: T[];
  errors: string[];
  success: boolean;
  totalRows: number;
  importedRows: number;
}

/**
 * Detecta el separador mirando solo la primera fila (fuera de comillas):
 * Excel en español guarda los CSV con ";", otros programas usan "," o tabulador.
 */
export function detectarSeparador(texto: string): string {
  const conteo: Record<string, number> = { ';': 0, ',': 0, '\t': 0 };
  let entreComillas = false;
  for (let i = 0; i < texto.length; i++) {
    const c = texto[i];
    if (c === '"') entreComillas = !entreComillas;
    else if (!entreComillas && (c === '\n' || c === '\r')) break;
    else if (!entreComillas && c in conteo) conteo[c]++;
  }
  const [mejor, cantidad] = Object.entries(conteo).sort((a, b) => b[1] - a[1])[0];
  return cantidad > 0 ? mejor : ',';
}

/**
 * Convierte el texto de un CSV en filas de celdas. Entiende comillas ("a, b"),
 * comillas escapadas ("") y saltos de línea dentro de una celda entre comillas,
 * ignora el carácter invisible (BOM) del inicio y las filas totalmente vacías.
 */
export function parsearCSV(texto: string): string[][] {
  if (texto.charCodeAt(0) === 0xfeff) texto = texto.slice(1);
  const separador = detectarSeparador(texto);

  const filas: string[][] = [];
  let fila: string[] = [];
  let campo = '';
  let entreComillas = false;

  for (let i = 0; i < texto.length; i++) {
    const c = texto[i];
    if (entreComillas) {
      if (c === '"') {
        if (texto[i + 1] === '"') { campo += '"'; i++; } else entreComillas = false;
      } else {
        campo += c;
      }
    } else if (c === '"' && campo.trim() === '') {
      campo = '';          // comilla de apertura (se descartan los espacios previos)
      entreComillas = true;
    } else if (c === separador) {
      fila.push(campo);
      campo = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && texto[i + 1] === '\n') i++;
      fila.push(campo);
      campo = '';
      filas.push(fila);
      fila = [];
    } else {
      campo += c;
    }
  }
  if (campo !== '' || fila.length > 0) {
    fila.push(campo);
    filas.push(fila);
  }

  return filas
    .map(f => f.map(v => v.trim()))
    .filter(f => f.some(v => v !== ''));
}

/** UTF-8 si el archivo lo es; si no, Windows-1252 (así guarda Excel los CSV comunes: ñ y tildes se conservan). */
export function decodificarCSV(buffer: ArrayBuffer): string {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(buffer);
  } catch {
    return new TextDecoder('windows-1252').decode(buffer);
  }
}

export async function importCSV<T>(
  file: File,
  mapping: Record<string, string>,
  validator?: (row: any) => string | null
): Promise<ImportResult<T>> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    const errors: string[] = [];
    const rows: T[] = [];

    reader.onload = (e) => {
      try {
        const filas = parsearCSV(decodificarCSV(e.target?.result as ArrayBuffer));

        if (filas.length < 2) {
          resolve({
            data: [],
            errors: ['El archivo CSV está vacío o no tiene datos'],
            success: false,
            totalRows: 0,
            importedRows: 0,
          });
          return;
        }

        // Igual que en Excel: el encabezado se busca tal cual y en minúsculas
        const headers = filas[0];

        for (let i = 1; i < filas.length; i++) {
          const values = filas[i];
          const row: any = {};

          headers.forEach((header, index) => {
            const mappedKey = mapping[header] || mapping[header.toLowerCase()] || header;
            row[mappedKey] = values[index] ?? '';
          });

          if (validator) {
            const error = validator(row);
            if (error) {
              errors.push(`Fila ${i + 1}: ${error}`);
              continue;
            }
          }

          rows.push(row as T);
        }

        resolve({
          data: rows,
          errors,
          success: errors.length === 0,
          totalRows: filas.length - 1,
          importedRows: rows.length,
        });
      } catch (error) {
        resolve({
          data: [],
          errors: [`Error al procesar el archivo: ${error}`],
          success: false,
          totalRows: 0,
          importedRows: 0,
        });
      }
    };

    reader.onerror = () => {
      resolve({
        data: [],
        errors: ['Error al leer el archivo'],
        success: false,
        totalRows: 0,
        importedRows: 0,
      });
    };

    reader.readAsArrayBuffer(file);
  });
}

export function generateCSVTemplate(headers: string[]): string {
  return headers.join(',') + '\n';
}

export function downloadCSVTemplate(filename: string, headers: string[]) {
  const csv = generateCSVTemplate(headers);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
  URL.revokeObjectURL(link.href);
}
