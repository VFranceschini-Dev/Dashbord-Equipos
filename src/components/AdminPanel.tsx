import { useState } from 'react';
import { useApp } from '../context/AppContext';
import { meshCentralService, MeshConfig, MeshNode } from '../services/meshCentral';
import { importCSV, downloadCSVTemplate } from '../utils/csvImporter';
import { importExcel, downloadExcelTemplate } from '../utils/excelImporter';
import { Equipment, Collaborator, Supplier } from '../types';
import { v4 as uuidv4 } from 'uuid';
import {
  Settings, Server, Upload, Download, Wifi, WifiOff, RefreshCw,
  CheckCircle, AlertCircle, Database, FileSpreadsheet, FileText,
  Users, Building2, Monitor, Save, Trash2, Play, Square
} from 'lucide-react';

export default function AdminPanel() {
  const { equipments, addEquipment, collaborators, addCollaborator, suppliers, addSupplier } = useApp();
  const [activeTab, setActiveTab] = useState<'mesh' | 'import' | 'export'>('mesh');
  
  // Mesh Config
  const [meshConfig, setMeshConfig] = useState<MeshConfig>(() => {
    const saved = meshCentralService.getConfig();
    return saved || {
      serverUrl: 'https://mesh.donnet.com.ar',
      username: '',
      password: '',
      autoSync: false,
      syncInterval: 5,
    };
  });
  const [meshConnected, setMeshConnected] = useState(meshCentralService.isConnected());
  const [meshNodes, setMeshNodes] = useState<MeshNode[]>([]);
  const [meshTesting, setMeshTesting] = useState(false);
  const [meshMessage, setMeshMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Import
  const [importType, setImportType] = useState<'equipment' | 'collaborator' | 'supplier'>('equipment');
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{ success: boolean; imported: number; errors: string[] } | null>(null);

  // Test Mesh Connection
  const handleTestMesh = async () => {
    setMeshTesting(true);
    setMeshMessage(null);
    
    meshCentralService.setConfig(meshConfig);
    const connected = await meshCentralService.connect();
    
    if (connected) {
      setMeshConnected(true);
      setMeshMessage({ type: 'success', text: 'Conexión exitosa con MeshCentral' });
      const nodes = await meshCentralService.getNodes();
      setMeshNodes(nodes);
    } else {
      setMeshConnected(false);
      setMeshMessage({ type: 'error', text: 'No se pudo conectar. Verifique la configuración.' });
    }
    
    setMeshTesting(false);
  };

  // Save Mesh Config
  const handleSaveMeshConfig = () => {
    meshCentralService.setConfig(meshConfig);
    setMeshMessage({ type: 'success', text: 'Configuración guardada' });
    
    if (meshConfig.autoSync) {
      meshCentralService.startAutoSync(meshConfig.syncInterval);
    } else {
      meshCentralService.stopAutoSync();
    }
  };

  // Import Mesh Nodes to Equipment
  const handleImportMeshNodes = async () => {
    const nodes = await meshCentralService.getNodes();
    const newEquipments = nodes.map(node => ({
      name: node.name,
      type: 'desktop' as const,
      brand: 'MeshCentral',
      model: node.os || 'Unknown',
      serialNumber: node.id,
      assetTag: `MESH-${node.id.substring(0, 8)}`,
      category: 'Informática',
      status: node.status === 'connected' ? 'assigned' as const : 'available' as const,
      purchaseDate: new Date().toISOString().split('T')[0],
      warrantyEnd: '',
      notes: `Importado desde MeshCentral. IP: ${node.ip}, Hostname: ${node.hostname}`,
      meshNodeId: node.id,
    }));

    newEquipments.forEach(eq => addEquipment(eq));
    setMeshMessage({ type: 'success', text: `${newEquipments.length} equipos importados desde MeshCentral` });
  };

  // Import CSV/Excel
  const handleFileImport = async (file: File) => {
    setImporting(true);
    setImportResult(null);

    const extension = file.name.split('.').pop()?.toLowerCase();
    
    let mapping: Record<string, string> = {};
    let validator: ((row: any) => string | null) | undefined;

    if (importType === 'equipment') {
      mapping = {
        'nombre': 'name', 'name': 'name',
        'tipo': 'type', 'type': 'type',
        'marca': 'brand', 'brand': 'brand',
        'modelo': 'model', 'model': 'model',
        'serial': 'serialNumber', 'serialNumber': 'serialNumber',
        'codigo': 'assetTag', 'assetTag': 'assetTag',
        'categoria': 'category', 'category': 'category',
      };
      validator = (row) => {
        if (!row.name) return 'Nombre es obligatorio';
        if (!row.brand) return 'Marca es obligatoria';
        return null;
      };
    } else if (importType === 'collaborator') {
      mapping = {
        'nombre': 'name', 'name': 'name',
        'apellido': 'lastName', 'lastName': 'lastName',
        'dni': 'dni',
        'email': 'email',
        'telefono': 'phone', 'phone': 'phone',
        'departamento': 'department', 'department': 'department',
        'cargo': 'position', 'position': 'position',
      };
      validator = (row) => {
        if (!row.name) return 'Nombre es obligatorio';
        if (!row.lastName) return 'Apellido es obligatorio';
        return null;
      };
    } else if (importType === 'supplier') {
      mapping = {
        'nombre': 'name', 'name': 'name',
        'cuit': 'cuit',
        'contacto': 'contact', 'contact': 'contact',
        'email': 'email',
        'telefono': 'phone', 'phone': 'phone',
        'direccion': 'address', 'address': 'address',
        'categoria': 'category', 'category': 'category',
      };
      validator = (row) => {
        if (!row.name) return 'Nombre es obligatorio';
        return null;
      };
    }

    let result;
    if (extension === 'csv') {
      result = await importCSV(file, mapping, validator);
    } else if (extension === 'xlsx' || extension === 'xls') {
      result = await importExcel(file, mapping, validator);
    } else {
      setImportResult({
        success: false,
        imported: 0,
        errors: ['Formato de archivo no soportado. Use CSV o Excel (.xlsx, .xls)'],
      });
      setImporting(false);
      return;
    }

    if (result.success || result.data.length > 0) {
      // Add to appropriate store
      if (importType === 'equipment') {
        (result.data as any[]).forEach(item => {
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
        (result.data as any[]).forEach(item => {
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
        (result.data as any[]).forEach(item => {
          addSupplier({
            ...item,
            id: uuidv4(),
            active: true,
            category: item.category || 'Hardware',
            notes: item.notes || '',
          } as Supplier);
        });
      }

      setImportResult({
        success: true,
        imported: result.data.length,
        errors: result.errors,
      });
    } else {
      setImportResult({
        success: false,
        imported: 0,
        errors: result.errors,
      });
    }

    setImporting(false);
  };

  // Download Templates
  const handleDownloadTemplate = (format: 'csv' | 'excel') => {
    let headers: string[] = [];
    let filename = '';

    if (importType === 'equipment') {
      headers = ['nombre', 'tipo', 'marca', 'modelo', 'serial', 'codigo', 'categoria'];
      filename = `plantilla_equipamientos.${format === 'csv' ? 'csv' : 'xlsx'}`;
    } else if (importType === 'collaborator') {
      headers = ['nombre', 'apellido', 'dni', 'email', 'telefono', 'departamento', 'cargo'];
      filename = `plantilla_colaboradores.${format === 'csv' ? 'csv' : 'xlsx'}`;
    } else if (importType === 'supplier') {
      headers = ['nombre', 'cuit', 'contacto', 'email', 'telefono', 'direccion', 'categoria'];
      filename = `plantilla_proveedores.${format === 'csv' ? 'csv' : 'xlsx'}`;
    }

    if (format === 'csv') {
      downloadCSVTemplate(filename, headers);
    } else {
      downloadExcelTemplate(filename, headers);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="bg-gradient-to-r from-slate-800 to-slate-900 rounded-2xl p-6 text-white">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-white/10 rounded-xl">
            <Settings size={32} />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Administración y Configuración</h1>
            <p className="text-sm text-slate-300">Gestione la configuración del sistema e integraciones</p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-gray-200">
        <button
          onClick={() => setActiveTab('mesh')}
          className={`px-6 py-3 font-semibold text-sm transition-colors ${
            activeTab === 'mesh'
              ? 'text-blue-600 border-b-2 border-blue-600'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <div className="flex items-center gap-2">
            <Server size={18} />
            MeshCentral
          </div>
        </button>
        <button
          onClick={() => setActiveTab('import')}
          className={`px-6 py-3 font-semibold text-sm transition-colors ${
            activeTab === 'import'
              ? 'text-blue-600 border-b-2 border-blue-600'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <div className="flex items-center gap-2">
            <Upload size={18} />
            Importar Datos
          </div>
        </button>
        <button
          onClick={() => setActiveTab('export')}
          className={`px-6 py-3 font-semibold text-sm transition-colors ${
            activeTab === 'export'
              ? 'text-blue-600 border-b-2 border-blue-600'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <div className="flex items-center gap-2">
            <Download size={18} />
            Exportar Datos
          </div>
        </button>
      </div>

      {/* MeshCentral Tab */}
      {activeTab === 'mesh' && (
        <div className="space-y-6">
          {/* Connection Status */}
          <div className={`p-4 rounded-xl border-2 ${
            meshConnected 
              ? 'bg-emerald-50 border-emerald-200' 
              : 'bg-gray-50 border-gray-200'
          }`}>
            <div className="flex items-center gap-3">
              {meshConnected ? (
                <Wifi className="w-6 h-6 text-emerald-600" />
              ) : (
                <WifiOff className="w-6 h-6 text-gray-400" />
              )}
              <div className="flex-1">
                <p className={`font-semibold ${meshConnected ? 'text-emerald-700' : 'text-gray-600'}`}>
                  {meshConnected ? 'Conectado a MeshCentral' : 'Desconectado'}
                </p>
                <p className="text-sm text-gray-500">
                  {meshConnected 
                    ? `${meshNodes.length} equipos sincronizados`
                    : 'Configure la conexión para comenzar'}
                </p>
              </div>
            </div>
          </div>

          {/* Configuration Form */}
          <div className="bg-white rounded-xl p-6 border border-gray-200 space-y-4">
            <h3 className="text-lg font-bold text-gray-800">Configuración de Conexión</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  URL del Servidor
                </label>
                <input
                  type="url"
                  value={meshConfig.serverUrl}
                  onChange={(e) => setMeshConfig({ ...meshConfig, serverUrl: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="https://mesh.donnet.com.ar"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Usuario
                </label>
                <input
                  type="text"
                  value={meshConfig.username}
                  onChange={(e) => setMeshConfig({ ...meshConfig, username: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="admin"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Contraseña
                </label>
                <input
                  type="password"
                  value={meshConfig.password}
                  onChange={(e) => setMeshConfig({ ...meshConfig, password: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="••••••••"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Intervalo de Sincronización (minutos)
                </label>
                <input
                  type="number"
                  value={meshConfig.syncInterval}
                  onChange={(e) => setMeshConfig({ ...meshConfig, syncInterval: parseInt(e.target.value) || 5 })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  min="1"
                />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="autoSync"
                checked={meshConfig.autoSync}
                onChange={(e) => setMeshConfig({ ...meshConfig, autoSync: e.target.checked })}
                className="rounded border-gray-300"
              />
              <label htmlFor="autoSync" className="text-sm text-gray-700">
                Sincronización automática
              </label>
            </div>

            {meshMessage && (
              <div className={`p-3 rounded-lg flex items-center gap-2 ${
                meshMessage.type === 'success' 
                  ? 'bg-emerald-50 text-emerald-700' 
                  : 'bg-red-50 text-red-700'
              }`}>
                {meshMessage.type === 'success' ? <CheckCircle size={18} /> : <AlertCircle size={18} />}
                {meshMessage.text}
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={handleTestMesh}
                disabled={meshTesting}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                <RefreshCw size={16} className={meshTesting ? 'animate-spin' : ''} />
                {meshTesting ? 'Probando...' : 'Probar Conexión'}
              </button>
              
              <button
                onClick={handleSaveMeshConfig}
                className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700"
              >
                <Save size={16} />
                Guardar Configuración
              </button>

              {meshConnected && (
                <button
                  onClick={handleImportMeshNodes}
                  className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
                >
                  <Database size={16} />
                  Importar Equipos de Mesh
                </button>
              )}
            </div>
          </div>

          {/* Mesh Nodes List */}
          {meshNodes.length > 0 && (
            <div className="bg-white rounded-xl p-6 border border-gray-200">
              <h3 className="text-lg font-bold text-gray-800 mb-4">
                Equipos en MeshCentral ({meshNodes.length})
              </h3>
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {meshNodes.map(node => (
                  <div key={node.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className={`w-2 h-2 rounded-full ${
                        node.status === 'connected' ? 'bg-emerald-500' : 'bg-red-500'
                      }`} />
                      <div>
                        <p className="font-medium text-gray-800">{node.name}</p>
                        <p className="text-xs text-gray-500">{node.ip} • {node.os}</p>
                      </div>
                    </div>
                    <span className={`px-2 py-1 rounded text-xs font-medium ${
                      node.status === 'connected'
                        ? 'bg-emerald-100 text-emerald-700'
                        : 'bg-red-100 text-red-700'
                    }`}>
                      {node.status === 'connected' ? 'Conectado' : 'Desconectado'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Import Tab */}
      {activeTab === 'import' && (
        <div className="space-y-6">
          {/* Import Type Selection */}
          <div className="bg-white rounded-xl p-6 border border-gray-200">
            <h3 className="text-lg font-bold text-gray-800 mb-4">Seleccionar Tipo de Datos</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <button
                onClick={() => setImportType('equipment')}
                className={`p-4 rounded-xl border-2 transition-all ${
                  importType === 'equipment'
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <Monitor size={32} className="mx-auto mb-2 text-blue-600" />
                <p className="font-semibold text-center">Equipamientos</p>
              </button>
              
              <button
                onClick={() => setImportType('collaborator')}
                className={`p-4 rounded-xl border-2 transition-all ${
                  importType === 'collaborator'
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <Users size={32} className="mx-auto mb-2 text-purple-600" />
                <p className="font-semibold text-center">Colaboradores</p>
              </button>
              
              <button
                onClick={() => setImportType('supplier')}
                className={`p-4 rounded-xl border-2 transition-all ${
                  importType === 'supplier'
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <Building2 size={32} className="mx-auto mb-2 text-emerald-600" />
                <p className="font-semibold text-center">Proveedores</p>
              </button>
            </div>
          </div>

          {/* Download Templates */}
          <div className="bg-white rounded-xl p-6 border border-gray-200">
            <h3 className="text-lg font-bold text-gray-800 mb-4">Descargar Plantillas</h3>
            <div className="flex gap-3">
              <button
                onClick={() => handleDownloadTemplate('csv')}
                className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
              >
                <FileText size={18} />
                Plantilla CSV
              </button>
              <button
                onClick={() => handleDownloadTemplate('excel')}
                className="flex items-center gap-2 px-4 py-2 bg-emerald-100 text-emerald-700 rounded-lg hover:bg-emerald-200"
              >
                <FileSpreadsheet size={18} />
                Plantilla Excel
              </button>
            </div>
          </div>

          {/* File Upload */}
          <div className="bg-white rounded-xl p-6 border border-gray-200">
            <h3 className="text-lg font-bold text-gray-800 mb-4">Importar Archivo</h3>
            <div className="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center">
              <Upload size={48} className="mx-auto mb-4 text-gray-400" />
              <p className="text-gray-600 mb-4">
                Arrastre un archivo CSV o Excel aquí, o haga clic para seleccionar
              </p>
              <input
                type="file"
                accept=".csv,.xlsx,.xls"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleFileImport(file);
                }}
                className="hidden"
                id="file-upload"
                disabled={importing}
              />
              <label
                htmlFor="file-upload"
                className="inline-block px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 cursor-pointer"
              >
                {importing ? 'Importando...' : 'Seleccionar Archivo'}
              </label>
            </div>

            {importResult && (
              <div className={`mt-4 p-4 rounded-lg ${
                importResult.success ? 'bg-emerald-50' : 'bg-red-50'
              }`}>
                <div className="flex items-center gap-2 mb-2">
                  {importResult.success ? (
                    <CheckCircle className="text-emerald-600" size={20} />
                  ) : (
                    <AlertCircle className="text-red-600" size={20} />
                  )}
                  <p className={`font-semibold ${
                    importResult.success ? 'text-emerald-700' : 'text-red-700'
                  }`}>
                    {importResult.success 
                      ? `${importResult.imported} registros importados exitosamente`
                      : 'Error al importar'}
                  </p>
                </div>
                {importResult.errors.length > 0 && (
                  <div className="mt-2 text-sm text-red-600">
                    <p className="font-medium">Errores:</p>
                    <ul className="list-disc list-inside">
                      {importResult.errors.map((error, i) => (
                        <li key={i}>{error}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Export Tab */}
      {activeTab === 'export' && (
        <div className="space-y-6">
          <div className="bg-white rounded-xl p-6 border border-gray-200">
            <h3 className="text-lg font-bold text-gray-800 mb-4">Exportar Datos del Sistema</h3>
            <p className="text-gray-600 mb-6">
              Exporte todos los datos del sistema en formato JSON para respaldo o migración
            </p>
            
            <button
              onClick={() => {
                const data = {
                  equipments,
                  collaborators,
                  suppliers,
                  exportDate: new Date().toISOString(),
                };
                const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `backup_sistema_${new Date().toISOString().split('T')[0]}.json`;
                a.click();
                URL.revokeObjectURL(a.href);
              }}
              className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              <Download size={20} />
              Exportar Todo (JSON)
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
