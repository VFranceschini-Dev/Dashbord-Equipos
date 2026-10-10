import { useState, useRef } from 'react';
import { Upload, FileText, FileSpreadsheet, X, CheckCircle, AlertCircle, Download, Database, Cloud, Eye, Save, ArrowLeft, ArrowRight } from 'lucide-react';
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

type ImportStep = 'upload' | 'review' | 'save';

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
  const [currentStep, setCurrentStep] = useState<ImportStep>('upload');
  const [file, setFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [syncingToSupabase, setSyncingToSupabase] = useState(false);
  const [importedData, setImportedData] = useState<any[]>([]);
  const [importErrors, setImportErrors] = useState<string[]>([]);
  const [saveResult, setSaveResult] = useState<{
    success: boolean;
    saved: number;
    errors: string[];
  } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      setImportedData([]);
      setImportErrors([]);
      setSaveResult(null);
    }
  };

  // PASO 1: Importar archivo localmente
  const handleImportLocal = async () => {
    if (!file) return;

    setImporting(true);
    setImportedData([]);
    setImportErrors([]);

    const extension = file.name.split('.').pop()?.toLowerCase();

    try {
      let importResult;

      if (extension === 'csv') {
        importResult = await importCSV(file, mapping, validator);
      } else if (extension === 'xlsx' || extension === 'xls') {
        importResult = await importExcel(file, mapping, validator);
      } else {
        setImportErrors(['Formato no soportado. Use CSV o Excel.']);
        setImporting(false);
        return;
      }

      if (importResult.data.length > 0) {
        // Guardar datos en memoria para revisión
        setImportedData(importResult.data);
        setImportErrors(importResult.errors);
        
        // Importar localmente
        onImport(importResult.data);
        
        // Avanzar al paso de revisión
        setCurrentStep('review');
      } else {
        setImportErrors(importResult.errors.length > 0 
          ? importResult.errors 
          : ['No se encontraron datos válidos en el archivo.']);
      }
    } catch (error) {
      setImportErrors([`Error al procesar el archivo: ${error}`]);
    }

    setImporting(false);
  };

  // PASO 3: Guardar en Supabase
  const handleSaveToSupabase = async () => {
    if (!entityType || importedData.length === 0) return;

    setSyncingToSupabase(true);
    setSaveResult(null);

    try {
      let supabaseResult;
      
      switch (entityType) {
        case 'printers':
          supabaseResult = await syncPrintersToSupabase(importedData as any[]);
          break;
        case 'toners':
          supabaseResult = await syncTonersToSupabase(importedData as any[]);
          break;
        case 'equipments':
          supabaseResult = await syncEquipmentsToSupabase(importedData as any[]);
          break;
        case 'suppliers':
          supabaseResult = await syncSuppliersToSupabase(importedData as any[]);
          break;
        case 'collaborators':
          supabaseResult = await syncCollaboratorsToSupabase(importedData as any[]);
          break;
        default:
          supabaseResult = { success: 0, errors: ['Tipo de entidad no soportado'] };
      }

      setSaveResult({
        success: supabaseResult.errors.length === 0,
        saved: supabaseResult.success,
        errors: supabaseResult.errors,
      });

      setCurrentStep('save');
    } catch (error) {
      setSaveResult({
        success: false,
        saved: 0,
        errors: ['Error al guardar los datos'],
      });
    }

    setSyncingToSupabase(false);
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
    setImportedData([]);
    setImportErrors([]);
    setSaveResult(null);
    setCurrentStep('upload');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  // Renderizar indicador de pasos
  const renderStepIndicator = () => (
    <div className="flex items-center justify-center gap-2 mb-6">
      <div className={`flex items-center gap-2 ${currentStep === 'upload' ? 'text-blue-600 dark:text-blue-400' : 'text-gray-400 dark:text-gray-500'}`}>
        <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
          currentStep === 'upload' ? 'bg-blue-600 text-white' : 
          currentStep === 'review' || currentStep === 'save' ? 'bg-emerald-500 text-white' :
          'bg-gray-200 dark:bg-gray-700'
        }`}>
          1
        </div>
        <span className="text-sm font-medium">Cargar</span>
      </div>
      <div className={`w-8 h-0.5 ${currentStep === 'review' || currentStep === 'save' ? 'bg-emerald-500' : 'bg-gray-200 dark:bg-gray-700'}`} />
      <div className={`flex items-center gap-2 ${currentStep === 'review' ? 'text-blue-600 dark:text-blue-400' : 'text-gray-400 dark:text-gray-500'}`}>
        <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
          currentStep === 'review' ? 'bg-blue-600 text-white' : 
          currentStep === 'save' ? 'bg-emerald-500 text-white' :
          'bg-gray-200 dark:bg-gray-700'
        }`}>
          2
        </div>
        <span className="text-sm font-medium">Revisar</span>
      </div>
      <div className={`w-8 h-0.5 ${currentStep === 'save' ? 'bg-emerald-500' : 'bg-gray-200 dark:bg-gray-700'}`} />
      <div className={`flex items-center gap-2 ${currentStep === 'save' ? 'text-blue-600 dark:text-blue-400' : 'text-gray-400 dark:text-gray-500'}`}>
        <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
          currentStep === 'save' ? 'bg-blue-600 text-white' : 'bg-gray-200 dark:bg-gray-700'
        }`}>
          3
        </div>
        <span className="text-sm font-medium">Guardar</span>
      </div>
    </div>
  );

  // PASO 1: Cargar archivo
  const renderUploadStep = () => (
    <>
      {/* Plantillas */}
      <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-200 dark:border-blue-800">
        <p className="text-sm font-medium text-blue-900 dark:text-blue-100 mb-3">
          📥 Importar plantilla (descarga el modelo para completar):
        </p>
        <div className="flex gap-2">
          <button
            onClick={() => handleDownloadTemplate('csv')}
            className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 text-sm font-medium text-gray-700 dark:text-gray-300"
          >
            <Download size={16} />
            Importar CSV
          </button>
          <button
            onClick={() => handleDownloadTemplate('xlsx')}
            className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 text-sm font-medium text-gray-700 dark:text-gray-300"
          >
            <Download size={16} />
            Importar Excel
          </button>
        </div>
        <p className="text-xs text-blue-700 dark:text-blue-300 mt-2">
          Columnas requeridas: {templateHeaders.join(', ')}
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

      {/* Errores de importación */}
      {importErrors.length > 0 && (
        <div className="p-4 bg-red-50 dark:bg-red-900/20 rounded-xl border border-red-200 dark:border-red-800">
          <div className="flex items-start gap-2">
            <AlertCircle className="text-red-600 dark:text-red-400 flex-shrink-0" size={20} />
            <div>
              <p className="font-semibold text-red-700 dark:text-red-300">Errores encontrados:</p>
              <ul className="list-disc list-inside text-sm text-red-600 dark:text-red-400 mt-1">
                {importErrors.map((error, i) => (
                  <li key={i}>{error}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* Botones de acción */}
      <div className="flex gap-3">
        <button
          onClick={handleImportLocal}
          disabled={!file || importing}
          className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
        >
          {importing ? (
            <>
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              Cargando...
            </>
          ) : (
            <>
              <Upload size={20} />
              Cargar Archivo
            </>
          )}
        </button>
        <button
          onClick={handleClose}
          className="px-6 py-3 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-xl hover:bg-gray-300 dark:hover:bg-gray-600 font-medium"
        >
          Cancelar
        </button>
      </div>
    </>
  );

  // PASO 2: Revisar datos importados
  const renderReviewStep = () => (
    <>
      {/* Resumen de importación */}
      <div className="p-4 bg-emerald-50 dark:bg-emerald-900/20 rounded-xl border border-emerald-200 dark:border-emerald-800">
        <div className="flex items-center gap-2 mb-2">
          <CheckCircle className="text-emerald-600 dark:text-emerald-400" size={20} />
          <p className="font-semibold text-emerald-700 dark:text-emerald-300">
            ✓ {importedData.length} registros importados localmente
          </p>
        </div>
        <p className="text-sm text-emerald-600 dark:text-emerald-400">
          Los datos están cargados en tu navegador. Revisa la información antes de guardar en la base de datos.
        </p>
      </div>

      {/* Errores parciales */}
      {importErrors.length > 0 && (
        <div className="p-4 bg-amber-50 dark:bg-amber-900/20 rounded-xl border border-amber-200 dark:border-amber-800">
          <p className="text-sm font-medium text-amber-700 dark:text-amber-300 mb-1">
            ⚠️ {importErrors.length} filas con errores (no se importaron):
          </p>
          <ul className="list-disc list-inside text-xs text-amber-600 dark:text-amber-400 max-h-20 overflow-y-auto">
            {importErrors.slice(0, 5).map((error, i) => (
              <li key={i}>{error}</li>
            ))}
            {importErrors.length > 5 && (
              <li>... y {importErrors.length - 5} errores más</li>
            )}
          </ul>
        </div>
      )}

      {/* Vista previa de datos */}
      <div>
        <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-2">
          <Eye size={16} />
          Vista previa de datos ({importedData.length} registros)
        </h4>
        <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden max-h-64 overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-gray-800 sticky top-0">
              <tr>
                {templateHeaders.slice(0, 5).map(header => (
                  <th key={header} className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                    {header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {importedData.slice(0, 10).map((row, i) => (
                <tr key={i} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                  {templateHeaders.slice(0, 5).map(header => {
                    const mappedKey = mapping[header] || header;
                    return (
                      <td key={header} className="px-3 py-2 text-gray-700 dark:text-gray-300 truncate max-w-[150px]">
                        {row[mappedKey] || row[header] || '-'}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
          {importedData.length > 10 && (
            <div className="p-2 text-center text-xs text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-800">
              ... y {importedData.length - 10} registros más
            </div>
          )}
        </div>
      </div>

      {/* Información sobre guardado */}
      {entityType && (
        <div className="p-4 bg-purple-50 dark:bg-purple-900/20 rounded-xl border border-purple-200 dark:border-purple-800">
          <div className="flex items-start gap-2">
            <Database className="text-purple-600 dark:text-purple-400 flex-shrink-0 mt-0.5" size={18} />
            <div>
              <p className="text-sm font-semibold text-purple-900 dark:text-purple-100">
                Guardar en Base de Datos
              </p>
              <p className="text-xs text-purple-700 dark:text-purple-300 mt-1">
                Al hacer clic en "Guardar", los datos se sincronizarán con tu base de datos en la nube. 
                Esto permite acceder a los datos desde cualquier dispositivo y mantener un respaldo automático.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Botones de acción */}
      <div className="flex gap-3">
        <button
          onClick={() => setCurrentStep('upload')}
          className="flex items-center gap-2 px-4 py-3 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-xl hover:bg-gray-300 dark:hover:bg-gray-600 font-medium"
        >
          <ArrowLeft size={18} />
          Volver
        </button>
        {entityType ? (
          <button
            onClick={handleSaveToSupabase}
            disabled={syncingToSupabase}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl hover:from-blue-700 hover:to-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium shadow-lg"
          >
            {syncingToSupabase ? (
              <>
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Guardando...
              </>
            ) : (
              <>
                <Cloud size={20} />
                Guardar
              </>
            )}
          </button>
        ) : (
          <button
            onClick={handleClose}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 font-medium"
          >
            <CheckCircle size={20} />
            Finalizar
          </button>
        )}
      </div>
    </>
  );

  // PASO 3: Resultado del guardado en Supabase
  const renderSaveStep = () => (
    <>
      {/* Resultado de guardado */}
      {saveResult && (
        <div className={`p-6 rounded-xl border-2 ${
          saveResult.success
            ? 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800'
            : 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800'
        }`}>
          <div className="flex items-start gap-3">
            {saveResult.success ? (
              <CheckCircle className="text-emerald-600 dark:text-emerald-400 flex-shrink-0" size={32} />
            ) : (
              <AlertCircle className="text-amber-600 dark:text-amber-400 flex-shrink-0" size={32} />
            )}
            <div className="flex-1">
              <p className={`text-lg font-bold ${
                saveResult.success ? 'text-emerald-700 dark:text-emerald-300' : 'text-amber-700 dark:text-amber-300'
              }`}>
                {saveResult.success ? '✓ Datos guardados exitosamente' : '⚠ Guardado parcial'}
              </p>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
                {saveResult.saved} de {importedData.length} registros guardados correctamente
              </p>
              
              {saveResult.errors.length > 0 && (
                <div className="mt-3">
                  <p className="text-sm font-medium text-amber-700 dark:text-amber-300 mb-1">
                    Errores de sincronización:
                  </p>
                  <ul className="list-disc list-inside text-xs text-amber-600 dark:text-amber-400 max-h-32 overflow-y-auto">
                    {saveResult.errors.slice(0, 10).map((error, i) => (
                      <li key={i}>{error}</li>
                    ))}
                    {saveResult.errors.length > 10 && (
                      <li>... y {saveResult.errors.length - 10} errores más</li>
                    )}
                  </ul>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Resumen final */}
      <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-200 dark:border-blue-800">
        <h4 className="text-sm font-semibold text-blue-900 dark:text-blue-100 mb-2">
          Resumen de la operación:
        </h4>
        <div className="space-y-1 text-sm text-blue-700 dark:text-blue-300">
          <p>• <strong>{importedData.length}</strong> registros procesados</p>
          <p>• <strong>{saveResult?.saved || 0}</strong> registros guardados correctamente</p>
          {importErrors.length > 0 && (
            <p>• <strong>{importErrors.length}</strong> filas con errores (no procesadas)</p>
          )}
          {saveResult && saveResult.errors.length > 0 && (
            <p>• <strong>{saveResult.errors.length}</strong> registros con errores</p>
          )}
        </div>
      </div>

      {/* Botón de finalizar */}
      <button
        onClick={handleClose}
        className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 font-medium"
      >
        <CheckCircle size={20} />
        Finalizar
      </button>
    </>
  );

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-3xl max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between sticky top-0 bg-white dark:bg-gray-800 z-10">
          <div>
            <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100">
              Importar {title}
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              {currentStep === 'upload' && 'Paso 1: Carga tu archivo'}
              {currentStep === 'review' && 'Paso 2: Revisa los datos antes de guardar'}
              {currentStep === 'save' && 'Paso 3: Confirmación de guardado'}
            </p>
          </div>
          <button onClick={handleClose} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg">
            <X size={20} className="text-gray-500 dark:text-gray-400" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {renderStepIndicator()}
          
          {currentStep === 'upload' && renderUploadStep()}
          {currentStep === 'review' && renderReviewStep()}
          {currentStep === 'save' && renderSaveStep()}
        </div>
      </div>
    </div>
  );
}
