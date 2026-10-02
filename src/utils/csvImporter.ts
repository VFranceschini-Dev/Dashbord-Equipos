export interface ImportResult<T> {
  data: T[];
  errors: string[];
  success: boolean;
  totalRows: number;
  importedRows: number;
}

export async function importCSV<T>(
  file: File,
  mapping: Record<string, string>,
  validator?: (row: any) => string | null
): Promise<ImportResult<T>> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    const errors: string[] = [];
    const data: T[] = [];

    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        const lines = text.split('\n').filter(line => line.trim());
        
        if (lines.length < 2) {
          resolve({
            data: [],
            errors: ['El archivo CSV está vacío o no tiene datos'],
            success: false,
            totalRows: 0,
            importedRows: 0,
          });
          return;
        }

        const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
        
        for (let i = 1; i < lines.length; i++) {
          const values = lines[i].split(',').map(v => v.trim().replace(/"/g, ''));
          const row: any = {};
          
          headers.forEach((header, index) => {
            const mappedKey = mapping[header] || header;
            row[mappedKey] = values[index] || '';
          });

          if (validator) {
            const error = validator(row);
            if (error) {
              errors.push(`Fila ${i + 1}: ${error}`);
              continue;
            }
          }

          data.push(row as T);
        }

        resolve({
          data,
          errors,
          success: errors.length === 0,
          totalRows: lines.length - 1,
          importedRows: data.length,
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

    reader.readAsText(file);
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
