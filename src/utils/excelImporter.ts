import * as XLSX from 'xlsx';
import { ImportResult } from './csvImporter';

export async function importExcel<T>(
  file: File,
  mapping: Record<string, string>,
  validator?: (row: any) => string | null
): Promise<ImportResult<T>> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    
    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: 'binary' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet);
        
        const rows: T[] = [];
        const errors: string[] = [];
        
        jsonData.forEach((row: any, index: number) => {
          const mappedRow: any = {};
          
          for (const [key, value] of Object.entries(row)) {
            const mappedKey = mapping[key] || key;
            mappedRow[mappedKey] = value;
          }
          
          if (validator) {
            const error = validator(mappedRow);
            if (error) {
              errors.push(`Fila ${index + 2}: ${error}`);
              return;
            }
          }
          
          rows.push(mappedRow as T);
        });
        
        resolve({
          data: rows,
          errors,
          success: errors.length === 0,
          totalRows: jsonData.length,
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
    
    reader.readAsBinaryString(file);
  });
}

export function downloadExcelTemplate(filename: string, headers: string[]) {
  const ws = XLSX.utils.aoa_to_sheet([headers]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Plantilla');
  XLSX.writeFile(wb, filename);
}
