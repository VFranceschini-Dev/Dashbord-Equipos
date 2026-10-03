import * as XLSX from 'xlsx';
import { ImportResult } from './csvImporter';

export async function importExcel<T>(
  file: File,
  mapping: Record<string, string>,
  validator?: (row: any) => string | null,
  sheetIndex: number = 0
): Promise<ImportResult<T>> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    const errors: string[] = [];
    const data: T[] = [];

    reader.onload = (e) => {
      try {
        const arrayBuffer = e.target?.result as ArrayBuffer;
        const workbook = XLSX.read(arrayBuffer, { type: 'array' });
        
        if (workbook.SheetNames.length === 0) {
          resolve({
            data: [],
            errors: ['El archivo Excel no tiene hojas'],
            success: false,
            totalRows: 0,
            importedRows: 0,
          });
          return;
        }

        const sheetName = workbook.SheetNames[sheetIndex];
        const sheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(sheet, { defval: '' });

        if (jsonData.length === 0) {
          resolve({
            data: [],
            errors: ['La hoja de Excel está vacía'],
            success: false,
            totalRows: 0,
            importedRows: 0,
          });
          return;
        }

        jsonData.forEach((row: any, index: number) => {
          const mappedRow: any = {};
          
          Object.keys(row).forEach(key => {
            const mappedKey = mapping[key] || key;
            mappedRow[mappedKey] = row[key];
          });

          if (validator) {
            const error = validator(mappedRow);
            if (error) {
              errors.push(`Fila ${index + 2}: ${error}`);
              return;
            }
          }

          data.push(mappedRow as T);
        });

        resolve({
          data,
          errors,
          success: errors.length === 0,
          totalRows: jsonData.length,
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

    reader.readAsArrayBuffer(file);
  });
}

export function downloadExcelTemplate(filename: string, headers: string[]) {
  const ws = XLSX.utils.aoa_to_sheet([headers]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Datos');
  XLSX.writeFile(wb, filename);
}

export function getExcelSheets(file: File): Promise<string[]> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    
    reader.onload = (e) => {
      try {
        const arrayBuffer = e.target?.result as ArrayBuffer;
        const workbook = XLSX.read(arrayBuffer, { type: 'array' });
        resolve(workbook.SheetNames);
      } catch (error) {
        resolve([]);
      }
    };

    reader.onerror = () => resolve([]);
    reader.readAsArrayBuffer(file);
  });
}
