import { useState, useRef } from 'react';
import { Upload, FileText, FileSpreadsheet, X, CheckCircle, AlertCircle, Download } from 'lucide-react';
import { importCSV } from '../utils/csvImporter';
import { importExcel } from '../utils/excelImporter';

interface ImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImport: (data: any[]) => void;
  title: string;
  templateHeaders: string[];
  mapping: Record<string, string>;
  validator?: (row: any) => string | null;
}

export default function ImportModal({
  isOpen,
  onClose,
  onImport,
  title,
  templateHeaders,
  mapping,
  validator,
}: ImportModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<{
    success: boolean;
    imported: number;
    total: number;
    errors: string[];
  } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      setResult(null);
    }
  };

  const handleImport = async () => {
    if (!file) return;

    setImporting(true);
    setResult(null);

    const extension = file.name.split('.').pop()?.toLowerCase();

    try {
      let importResult;

      if (extension === 'csv') {
        importResult = await importCSV(file, mapping, validator);
      } else if (extension === 'xlsx' || extension === 'xls') {
        importResult = await importExcel(file, mapping, validator);
      } else {
        setResult({
          success: false,
          imported: 0,
          total: 0,
          errors: ['Formato no soportado. Use CSV o Excel.'],
        });
        setImporting(false);
        return;
      }

      if (importResult.data.length > 0) {
        onImport(importResult.data);
      }

      setResult({
        success: importResult.success,
        imported: importResult.data.length,
        total: importResult.totalRows,
        errors: importResult.errors,
      });
    } catch (error) {
      setResult({
        success: false,
        imported: 0,
        total: 0,
        errors: [`Error: ${error}`],
      });
    }

    setImporting(false);
  };

  const handleDownloadTemplate = (format: 'csv' | 'xlsx') => {
    const filename = `plantilla_${title.toLowerCase().replace(/\s+/g, '_')}.${format}`;
    
    if (format === 'csv') {
      const csv = templateHeaders.join(',') + '\n';
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = filename;
      link.click();
    } else {
      import('xlsx').then((XLSX) => {
        const ws = XLSX.utils.aoa_to_sheet([templateHeaders]);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Plantilla');
        XLSX.writeFile(wb, filename);
      });
    }
  };

  const reset = () => {
    setFile(null);
    setResult(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
          <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100">
            Importar {title}
          </h3>
          <button onClick={() => { reset(); onClose(); }} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg">
            <X size={20} className="text-gray-500 dark:text-gray-400" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Plantillas */}
          <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-200 dark:border-blue-800">
            <p className="text-sm font-medium text-blue-900 dark:text-blue-100 mb-3">
              📥 Descarga una plantilla para empezar:
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => handleDownloadTemplate('csv')}
                className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 text-sm font-medium text-gray-700 dark:text-gray-300"
              >
                <FileText size={16} />
                CSV
              </button>
              <button
                onClick={() => handleDownloadTemplate('xlsx')}
                className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 text-sm font-medium text-gray-700 dark:text-gray-300"
              >
                <FileSpreadsheet size={16} />
                Excel
              </button>
            </div>
            <p className="text-xs text-blue-700 dark:text-blue-300 mt-2">
              Columnas: {templateHeaders.join(', ')}
            </p>
          </div>

          {/* Selector de archivo */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Selecciona tu archivo
            </label>
            <div className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-xl p-8 text-center hover:border-blue-400 transition-colors">
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,.xlsx,.xls"
                onChange={handleFileChange}
                className="hidden"
                id="file-upload-modal"
              />
              <label htmlFor="file-upload-modal" className="cursor-pointer">
                <Upload className="w-12 h-12 mx-auto mb-3 text-gray-400 dark:text-gray-500" />
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {file ? file.name : 'Haz clic para seleccionar un archivo'}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                  CSV o Excel (.xlsx, .xls)
                </p>
              </label>
            </div>
          </div>

          {/* Botones de acción */}
          <div className="flex gap-3">
            <button
              onClick={handleImport}
              disabled={!file || importing}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
            >
              {importing ? (
                <>
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Importando...
                </>
              ) : (
                <>
                  <Upload size={20} />
                  Importar Datos
                </>
              )}
            </button>
            <button
              onClick={() => { reset(); onClose(); }}
              className="px-6 py-3 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-xl hover:bg-gray-300 dark:hover:bg-gray-600 font-medium"
            >
              Cancelar
            </button>
          </div>

          {/* Resultados */}
          {result && (
            <div className={`p-4 rounded-xl border-2 ${
              result.success
                ? 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800'
                : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
            }`}>
              <div className="flex items-start gap-3">
                {result.success ? (
                  <CheckCircle className="text-emerald-600 dark:text-emerald-400 flex-shrink-0" size={24} />
                ) : (
                  <AlertCircle className="text-red-600 dark:text-red-400 flex-shrink-0" size={24} />
                )}
                <div className="flex-1">
                  <p className={`font-semibold ${
                    result.success ? 'text-emerald-700 dark:text-emerald-300' : 'text-red-700 dark:text-red-300'
                  }`}>
                    {result.success
                      ? `✓ ${result.imported} registros importados exitosamente`
                      : '✗ Error al importar datos'}
                  </p>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                    Total de filas procesadas: {result.total}
                  </p>
                  {result.errors.length > 0 && (
                    <div className="mt-3">
                      <p className="text-sm font-medium text-red-600 dark:text-red-400 mb-1">
                        Errores encontrados:
                      </p>
                      <ul className="list-disc list-inside text-sm text-red-600 dark:text-red-400 max-h-32 overflow-y-auto">
                        {result.errors.slice(0, 10).map((error, i) => (
                          <li key={i}>{error}</li>
                        ))}
                        {result.errors.length > 10 && (
                          <li>... y {result.errors.length - 10} errores más</li>
                        )}
                      </ul>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
