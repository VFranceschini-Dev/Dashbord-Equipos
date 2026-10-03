import mammoth from 'mammoth';
import { ImportResult } from './csvImporter';

export async function importDocx<T>(
  file: File,
  mapping: Record<string, string>,
  validator?: (row: any) => string | null
): Promise<ImportResult<T>> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    const errors: string[] = [];
    const rows: T[] = [];

    reader.onload = async (e) => {
      try {
        const arrayBuffer = e.target?.result as ArrayBuffer;
        
        // Extraer texto del DOCX
        const result = await mammoth.extractRawText({ arrayBuffer });
        const text = result.value;
        
        // Parsear el texto buscando tablas o líneas con delimitadores
        const lines = text.split('\n').filter(line => line.trim());
        
        if (lines.length < 2) {
          resolve({
            data: [],
            errors: ['El documento está vacío o no tiene datos'],
            success: false,
            totalRows: 0,
            importedRows: 0,
          });
          return;
        }

        // Detectar delimitador (coma, tabulación, punto y coma)
        const firstLine = lines[0];
        let delimiter = ',';
        if (firstLine.includes('\t')) delimiter = '\t';
        else if (firstLine.includes(';')) delimiter = ';';

        const headers = firstLine.split(delimiter).map(h => h.trim().replace(/"/g, ''));
        
        for (let i = 1; i < lines.length; i++) {
          const values = lines[i].split(delimiter).map(v => v.trim().replace(/"/g, ''));
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

          rows.push(row as T);
        }

        resolve({
          data: rows,
          errors,
          success: errors.length === 0,
          totalRows: lines.length - 1,
          importedRows: rows.length,
        });
      } catch (error) {
        resolve({
          data: [],
          errors: [`Error al procesar el documento: ${error}`],
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
