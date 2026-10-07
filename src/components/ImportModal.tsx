import { useState, useRef } from 'react';
import { Upload, FileText, FileSpreadsheet, X, CheckCircle, AlertCircle, Download, Database, Cloud } from 'lucide-react';
import { importCSV } from '../utils/csvImporter';
import { importExcel } from '../utils/excelImporter';
import { 
  syncPrintersToSupabase, 
  syncTonersToSupabase, 
  syncEquipmentsToSupabase, 
  syncSuppliersToSupabase, 
  syncCollaboratorsToSupabase 
} from '../services/supabaseSync';

interface ImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImport: (data: any[]) => void;
  title: string;
  templateHeaders: string[];
  mapping: Record<string, string>;
  validator?: (row: any) => string | null;
  entityType?: 'printers' | 'toners' | 'equipments' | 'suppliers' | 'collaborators';
}

export default function ImportModal({
  isOpen,
  onClose,
  onImport,
  title,
  templateHeaders,
  mapping,
  validator,
  entityType,
}: ImportModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [saveToSupabase, setSaveToSupabase] = useState(false);
  const [syncingToSupabase, setSyncingToSupabase] = useState(false);
  const [result, setResult] = useState<{
    success: boolean;
    imported: number;
    total: number;
    errors: string[];
    supabaseResult?: {
      synced: number;
      errors: string[];
    };
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

      // Si hay errores pero también datos importados, mostrar resultado parcial
      let finalResult: any = {
        success: importResult.success,
        imported: importResult.data.length,
        total: importResult.totalRows,
        errors: importResult.errors,
      };

      // Sincronizar con Supabase si está seleccionado y hay datos importados
      if (saveToSupabase && importResult.data.length > 0 && entityType) {
        setSyncingToSupabase(true);
        
        try {
          let supabaseResult;
          
          switch (entityType) {
            case 'printers':
              supabaseResult = await syncPrintersToSupabase(importResult.data as any[]);
              break;
            case 'toners':
              supabaseResult = await syncTonersToSupabase(importResult.data as any[]);
              break;
            case 'equipments':
              supabaseResult = await syncEquipmentsToSupabase(importResult.data as any[]);
              break;
            case 'suppliers':
              supabaseResult = await syncSuppliersToSupabase(importResult.data as any[]);
              break;
            case 'collaborators':
              supabaseResult = await syncCollaboratorsToSupabase(importResult.data as any[]);
              break;
            default:
              supabaseResult = { success: 0, errors: ['Tipo de entidad no soportado'] };
          }
          
          finalResult.supabaseResult = supabaseResult;
          
          // Si hubo errores en la sincronización con Supabase, agregarlos a los errores
          if (supabaseResult.errors.length > 0) {
            finalResult.errors = [...finalResult.errors, ...supabaseResult.errors];
            finalResult.success = false;
          }
        } catch (error) {
          finalResult.supabaseResult = {
            synced: 0,
            errors: [`Error al sincronizar con Supabase: ${error}`],
          };
          finalResult.errors.push(`Error al sincronizar con Supabase: ${error}`);
          finalResult.success = false;
        }
        
        setSyncingToSupabase(false);
      }

      setResult(finalResult);
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
      URL.revokeObjectURL(link.href);
    } else {
      import('xlsx').then((XLSX) => {
        // Crear datos de ejemplo basados en los headers
        const exampleRow: any = {};
        templateHeaders.forEach(header => {
          const lowerHeader = header.toLowerCase();
          if (lowerHeader.includes('nombre') || lowerHeader.includes('name')) {
            exampleRow[header] = 'Ejemplo';
          } else if (lowerHeader.includes('modelo') || lowerHeader.includes('model')) {
            exampleRow[header] = 'Modelo Ejemplo';
          } else if (lowerHeader.includes('ubicacion') || lowerHeader.includes('location')) {
            exampleRow[header] = 'Ubicación Ejemplo';
          } else if (lowerHeader.includes('departamento') || lowerHeader.includes('department')) {
            exampleRow[header] = 'Departamento';
          } else if (lowerHeader.includes('estado') || lowerHeader.includes('status')) {
            exampleRow[header] = 'active';
          } else if (lowerHeader.includes('toner')) {
            exampleRow[header] = 'CF258A';
          } else if (lowerHeader.includes('pagina')) {
            exampleRow[header] = '1000';
          } else {
            exampleRow[header] = '';
          }
        });
        
        const data = [templateHeaders, Object.values(exampleRow)];
        const ws = XLSX.utils.aoa_to_sheet(data);
        
        // Ajustar el ancho de las columnas
        const colWidths = templateHeaders.map(header => ({ wch: Math.max(header.length + 2, 15) }));
        ws['!cols'] = colWidths;
        
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

          {/* Opción de guardar en Supabase */}
          {entityType && (
            <div className="p-4 bg-purple-50 dark:bg-purple-900/20 rounded-xl border border-purple-200 dark:border-purple-800">
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={saveToSupabase}
                  onChange={(e) => setSaveToSupabase(e.target.checked)}
                  className="mt-1 w-4 h-4 text-purple-600 border-purple-300 rounded focus:ring-purple-500"
                />
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <Database size={16} className="text-purple-600 dark:text-purple-400" />
                    <span className="text-sm font-semibold text-purple-900 dark:text-purple-100">
                      Guardar en Base de Datos (Supabase)
                    </span>
                  </div>
                  <p className="text-xs text-purple-700 dark:text-purple-300">
                    Los datos importados se sincronizarán con tu base de datos en la nube. 
                    Esto permite acceder a los datos desde cualquier dispositivo y mantener un respaldo automático.
                  </p>
                </div>
              </label>
            </div>
          )}

          {/* Botones de acción */}
          <div className="flex gap-3">
            <button
              onClick={handleImport}
              disabled={!file || importing || syncingToSupabase}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
            >
              {importing || syncingToSupabase ? (
                <>
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  {syncingToSupabase ? 'Sincronizando con Supabase...' : 'Importando...'}
                </>
              ) : (
                <>
                  <Upload size={20} />
                  {saveToSupabase ? 'Importar y Guardar en Supabase' : 'Importar Datos'}
                </>
              )}
            </button>
            <button
              onClick={() => { reset(); onClose(); }}
              disabled={importing || syncingToSupabase}
              className="px-6 py-3 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-xl hover:bg-gray-300 dark:hover:bg-gray-600 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
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
                  
                  {/* Resultados de sincronización con Supabase */}
                  {result.supabaseResult && (
                    <div className="mt-3 p-3 bg-purple-50 dark:bg-purple-900/20 rounded-lg border border-purple-200 dark:border-purple-800">
                      <div className="flex items-center gap-2 mb-2">
                        <Cloud size={16} className="text-purple-600 dark:text-purple-400" />
                        <span className="text-sm font-semibold text-purple-900 dark:text-purple-100">
                          Sincronización con Supabase
                        </span>
                      </div>
                      <p className="text-sm text-purple-700 dark:text-purple-300">
                        {result.supabaseResult.synced > 0 
                          ? `✓ ${result.supabaseResult.synced} registros sincronizados con la base de datos`
                          : '✗ No se pudieron sincronizar registros con la base de datos'}
                      </p>
                      {result.supabaseResult.errors.length > 0 && (
                        <div className="mt-2">
                          <p className="text-xs font-medium text-red-600 dark:text-red-400 mb-1">
                            Errores de sincronización:
                          </p>
                          <ul className="list-disc list-inside text-xs text-red-600 dark:text-red-400 max-h-20 overflow-y-auto">
                            {result.supabaseResult.errors.slice(0, 5).map((error, i) => (
                              <li key={i}>{error}</li>
                            ))}
                            {result.supabaseResult.errors.length > 5 && (
                              <li>... y {result.supabaseResult.errors.length - 5} errores más</li>
                            )}
                          </ul>
                        </div>
                      )}
                    </div>
                  )}

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
