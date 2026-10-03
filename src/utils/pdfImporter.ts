import * as pdfjsLib from 'pdfjs-dist';
import { ImportResult } from './csvImporter';

// Configurar worker de PDF.js
pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

export async function importPdf<T>(
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
        const typedArray = new Uint8Array(e.target?.result as ArrayBuffer);
        
        // Cargar el PDF
        const pdf = await pdfjsLib.getDocument({ data: typedArray }).promise;
        let fullText = '';
        
        // Extraer texto de todas las páginas
        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          const textContent = await page.getTextContent();
          const pageText = textContent.items
            .map((item: any) => item.str)
            .join(' ');
          fullText += pageText + '\n';
        }
        
        // Parsear el texto buscando líneas con delimitadores
        const lines = fullText.split('\n').filter(line => line.trim());
        
        if (lines.length < 2) {
          resolve({
            data: [],
            errors: ['El PDF está vacío o no tiene datos'],
            success: false,
            totalRows: 0,
            importedRows: 0,
          });
          return;
        }

        // Detectar delimitador (coma, tabulación, punto y coma, o múltiples espacios)
        const firstLine = lines[0];
        let delimiter = ',';
        if (firstLine.includes('\t')) delimiter = '\t';
        else if (firstLine.includes(';')) delimiter = ';';
        else if (firstLine.includes('  ')) delimiter = '  '; // Doble espacio

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
          errors: [`Error al procesar el PDF: ${error}`],
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
