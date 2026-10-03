import { useState, useRef } from 'react';
import { useApp } from '../context/AppContext';
import { importCSV, downloadCSVTemplate } from '../utils/csvImporter';
import { importExcel, downloadExcelTemplate } from '../utils/excelImporter';
import { importDocx } from '../utils/docxImporter';
import { importPdf } from '../utils/pdfImporter';
import { Equipment, Collaborator, Supplier } from '../types';
import { v4 as uuidv4 } from 'uuid';
import {
  Upload, FileText, FileSpreadsheet, File, CheckCircle, AlertCircle,
  Download, X, Loader2
} from 'lucide-react';

type ImportType = 'equipment' | 'collaborator' | 'supplier';

export default function ImportData() {
  const { addEquipment, addCollaborator, addSupplier } = useApp();
  const [importType, setImportType] = useState<ImportType>('equipment');
  const [file, setFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<{
    success: boolean;
    imported: number;
    total: number;
    errors: string[];
  } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const getMapping = (): Record<string, string> => {
    if (importType === 'equipment') {
      return {
        'nombre': 'name', 'name': 'name',
        'tipo': 'type', 'type': 'type',
        'marca': 'brand', 'brand': 'brand',
        'modelo': 'model', 'model': 'model',
        'serial': 'serialNumber', 'serialNumber': 'serialNumber',
        'codigo': 'assetTag', 'assetTag': 'assetTag',
        'categoria': 'category', 'category': 'category',
      };
    } else if (importType === 'collaborator') {
      return {
        'nombre': 'name', 'name': 'name',
        'apellido': 'lastName', 'lastName': 'lastName',
        'dni': 'dni',
        'email': 'email',
        'telefono': 'phone', 'phone': 'phone',
        'departamento': 'department', 'department': 'department',
        'cargo': 'position', 'position': 'position',
      };
    } else {
      return {
        'nombre': 'name', 'name': 'name',
        'cuit': 'cuit',
        'contacto': 'contact', 'contact': 'contact',
        'email': 'email',
        'telefono': 'phone', 'phone': 'phone',
        'direccion': 'address', 'address': 'address',
        'categoria': 'category', 'category': 'category',
      };
    }
  };

  const getValidator = () => {
    if (importType === 'equipment') {
      return (row: any) => {
        if (!row.name) return 'Nombre es obligatorio';
        if (!row.brand) return 'Marca es obligatoria';
        return null;
      };
    } else if (importType === 'collaborator') {
      return (row: any) => {
        if (!row.name) return 'Nombre es obligatorio';
        if (!row.lastName) return 'Apellido es obligatorio';
        return null;
      };
    } else {
      return (row: any) => {
        if (!row.name) return 'Nombre es obligatorio';
        return null;
      };
    }
  };

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
    const mapping = getMapping();
    const validator = getValidator();

    let importResult;

    try {
      if (extension === 'csv') {
        importResult = await importCSV(file, mapping, validator);
      } else if (extension === 'xlsx' || extension === 'xls') {
        importResult = await importExcel(file, mapping, validator);
      } else if (extension === 'docx') {
        importResult = await importDocx(file, mapping, validator);
      } else if (extension === 'pdf') {
        importResult = await importPdf(file, mapping, validator);
      } else {
        setResult({
          success: false,
          imported: 0,
          total: 0,
          errors: ['Formato de archivo no soportado. Use CSV, Excel, Word o PDF.'],
        });
        setImporting(false);
        return;
      }

      // Agregar datos al contexto
      if (importResult.data.length > 0) {
        if (importType === 'equipment') {
          (importResult.data as any[]).forEach(item => {
            addEquipment({
              ...item,
              id: uuidv4(),
              type: item.type || 'desktop',
              status: item.status || 'available',
              category: item.category || 'Informática',
              purchaseDate: item.purchaseDate || new Date().toISOString().split('T')[0],
              warrantyEnd: item.warrantyEnd || '',
              notes: item.notes || '',
            } as Equipment);
          });
        } else if (importType === 'collaborator') {
          (importResult.data as any[]).forEach(item => {
            addCollaborator({
              ...item,
              id: uuidv4(),
              active: true,
              equipmentCount: 0,
              joinDate: item.joinDate || new Date().toISOString().split('T')[0],
              notes: item.notes || '',
            } as Collaborator);
          });
        } else if (importType === 'supplier') {
          (importResult.data as any[]).forEach(item => {
            addSupplier({
              ...item,
              id: uuidv4(),
              active: true,
              category: item.category || 'Hardware',
              notes: item.notes || '',
            } as Supplier);
          });
        }
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
        errors: [`Error al importar: ${error}`],
      });
    }

    setImporting(false);
  };

  const handleDownloadTemplate = (format: 'csv' | 'xlsx') => {
    let headers: string[] = [];
    let filename = '';

    if (importType === 'equipment') {
      headers = ['nombre', 'tipo', 'marca', 'modelo', 'serial', 'codigo', 'categoria'];
      filename = `plantilla_equipamientos.${format}`;
    } else if (importType === 'collaborator') {
      headers = ['nombre', 'apellido', 'dni', 'email', 'telefono', 'departamento', 'cargo'];
      filename = `plantilla_colaboradores.${format}`;
    } else {
      headers = ['nombre', 'cuit', 'contacto', 'email', 'telefono', 'direccion', 'categoria'];
      filename = `plantilla_proveedores.${format}`;
    }

    if (format === 'csv') {
      downloadCSVTemplate(filename, headers);
    } else {
      downloadExcelTemplate(filename, headers);
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
    <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
      <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-4">Importar Datos</h3>

      {/* Tipo de datos */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Tipo de datos a importar
        </label>
        <div className="grid grid-cols-3 gap-3">
          <button
            onClick={() => setImportType('equipment')}
            className={`p-4 rounded-xl border-2 transition-all ${
              importType === 'equipment'
                ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                : 'border-gray-200 dark:border-gray-700 hover:border-gray-300'
            }`}
          >
            <File className="w-8 h-8 mx-auto mb-2 text-blue-600" />
            <p className="text-sm font-medium text-center">Equipamientos</p>
          </button>
          <button
            onClick={() => setImportType('collaborator')}
            className={`p-4 rounded-xl border-2 transition-all ${
              importType === 'collaborator'
                ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                : 'border-gray-200 dark:border-gray-700 hover:border-gray-300'
            }`}
          >
            <FileText className="w-8 h-8 mx-auto mb-2 text-purple-600" />
            <p className="text-sm font-medium text-center">Colaboradores</p>
          </button>
          <button
            onClick={() => setImportType('supplier')}
            className={`p-4 rounded-xl border-2 transition-all ${
              importType === 'supplier'
                ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                : 'border-gray-200 dark:border-gray-700 hover:border-gray-300'
            }`}
          >
            <FileSpreadsheet className="w-8 h-8 mx-auto mb-2 text-emerald-600" />
            <p className="text-sm font-medium text-center">Proveedores</p>
          </button>
        </div>
      </div>

      {/* Plantillas */}
      <div className="mb-6 p-4 bg-gray-50 dark:bg-gray-900/50 rounded-xl">
        <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Descargar plantillas:
        </p>
        <div className="flex gap-2">
          <button
            onClick={() => handleDownloadTemplate('csv')}
            className="flex items-center gap-2 px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 text-sm"
          >
            <Download size={16} />
            CSV
          </button>
          <button
            onClick={() => handleDownloadTemplate('xlsx')}
            className="flex items-center gap-2 px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 text-sm"
          >
            <Download size={16} />
            Excel
          </button>
        </div>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
          Formatos soportados: CSV, Excel (.xlsx, .xls), Word (.docx), PDF
        </p>
      </div>

      {/* Selector de archivo */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Seleccionar archivo
        </label>
        <div className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-xl p-6 text-center hover:border-blue-400 transition-colors">
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,.xlsx,.xls,.docx,.pdf"
            onChange={handleFileChange}
            className="hidden"
            id="file-upload"
          />
          <label htmlFor="file-upload" className="cursor-pointer">
            <Upload className="w-12 h-12 mx-auto mb-3 text-gray-400" />
            <p className="text-sm text-gray-600 dark:text-gray-400">
              {file ? file.name : 'Haz clic para seleccionar un archivo'}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
              CSV, Excel, Word o PDF
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
              <Loader2 className="w-5 h-5 animate-spin" />
              Importando...
            </>
          ) : (
            <>
              <Upload size={20} />
              Importar Datos
            </>
          )}
        </button>
        {file && (
          <button
            onClick={reset}
            className="px-4 py-3 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-xl hover:bg-gray-300 dark:hover:bg-gray-600 font-medium"
          >
            <X size={20} />
          </button>
        )}
      </div>

      {/* Resultados */}
      {result && (
        <div className={`mt-6 p-4 rounded-xl border-2 ${
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
  );
}
