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
        if (!data) {
          resolve({
            data: [],
            errors: ['El archivo está vacío'],
            success: false,
            totalRows: 0,
            importedRows: 0,
          });
          return;
        }

        // Leer el archivo Excel usando ArrayBuffer (más robusto)
        const workbook = XLSX.read(data, { type: 'array' });
        
        if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
          resolve({
            data: [],
            errors: ['El archivo Excel no tiene hojas'],
            success: false,
            totalRows: 0,
            importedRows: 0,
          });
          return;
        }

        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { defval: '' });
        
        if (!jsonData || jsonData.length === 0) {
          resolve({
            data: [],
            errors: ['La hoja de Excel está vacía'],
            success: false,
            totalRows: 0,
            importedRows: 0,
          });
          return;
        }
        
        const rows: T[] = [];
        const errors: string[] = [];
        
        jsonData.forEach((row: any, index: number) => {
          const mappedRow: any = {};
          
          // Mapear cada columna del Excel
          for (const [key, value] of Object.entries(row)) {
            // Normalizar la clave (eliminar espacios, convertir a minúsculas)
            const normalizedKey = key.toString().trim().toLowerCase();
            
            // Buscar en el mapping (tanto la clave original como la normalizada)
            const mappedKey = mapping[key] || mapping[normalizedKey] || key;
            
            // Convertir el valor a string si es necesario
            const stringValue = value !== null && value !== undefined ? String(value).trim() : '';
            mappedRow[mappedKey] = stringValue;
          }
          
          // Validar la fila
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
        console.error('Error al procesar Excel:', error);
        resolve({
          data: [],
          errors: [`Error al procesar el archivo: ${error instanceof Error ? error.message : String(error)}`],
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
    
    // Usar ArrayBuffer en lugar de binary string (más robusto para Excel)
    reader.readAsArrayBuffer(file);
  });
}

export function downloadExcelTemplate(filename: string, headers: string[], exampleData?: any[]) {
  // Crear hoja con encabezados
  const data = [headers];
  
  // Agregar datos de ejemplo si se proporcionan
  if (exampleData && exampleData.length > 0) {
    exampleData.forEach(row => {
      const rowData = headers.map(header => row[header] || '');
      data.push(rowData);
    });
  } else {
    // Agregar una fila vacía de ejemplo
    data.push(headers.map(() => ''));
  }
  
  const ws = XLSX.utils.aoa_to_sheet(data);
  
  // Ajustar el ancho de las columnas
  const colWidths = headers.map(header => ({ wch: Math.max(header.length + 2, 15) }));
  ws['!cols'] = colWidths;
  
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Plantilla');
  XLSX.writeFile(wb, filename);
}

export function downloadPrinterTemplate() {
  const headers = ['nombre', 'modelo', 'ubicacion', 'departamento', 'toner', 'estado', 'paginas'];
  const exampleData = [
    {
      nombre: 'Impresora HP LaserJet',
      modelo: 'HP LaserJet Pro M404',
      ubicacion: 'Oficina Principal',
      departamento: 'Administración',
      toner: 'CF258A',
      estado: 'active',
      paginas: '1500',
    },
    {
      nombre: 'Impresora Epson',
      modelo: 'Epson EcoTank L3250',
      ubicacion: 'Sala de Reuniones',
      departamento: 'RRHH',
      toner: 'T544',
      estado: 'active',
      paginas: '800',
    },
  ];
  
  downloadExcelTemplate('plantilla_impresoras.xlsx', headers, exampleData);
}
