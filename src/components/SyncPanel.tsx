import { useState, useEffect } from 'react';
import { useSupabaseSync } from '../hooks/useSupabaseSync';
import { useApp } from '../context/AppContext';
import { syncAllFromSupabase } from '../services/supabaseSync';
import { Cloud, CloudOff, RefreshCw, Download, Upload, CheckCircle, AlertCircle, Database } from 'lucide-react';

export default function SyncPanel() {
  const { isConnected, syncStatus, lastSyncMessage, checkConnection, saveToSupabase } = useSupabaseSync();
  const { printers, toners, equipments, suppliers, collaborators, vouchers, 
          setPrinters, setToners, setEquipments, setSuppliers, setCollaborators, setVouchers } = useApp();
  
  const [syncingAll, setSyncingAll] = useState(false);
  const [syncMessage, setSyncMessage] = useState<string>('');

  useEffect(() => {
    checkConnection();
  }, [checkConnection]);

  // Sincronizar TODO desde Supabase hacia localStorage
  const handleSyncFromSupabase = async () => {
    setSyncingAll(true);
    setSyncMessage('Descargando datos desde Supabase...');

    try {
      const data = await syncAllFromSupabase();
      
      setPrinters(data.printers);
      setToners(data.toners);
      setEquipments(data.equipments);
      setSuppliers(data.suppliers);
      setCollaborators(data.collaborators);
      setVouchers(data.vouchers);
      
      setSyncMessage(`✓ Datos descargados: ${data.printers.length} impresoras, ${data.toners.length} tóners, ${data.equipments.length} equipos, ${data.suppliers.length} proveedores, ${data.collaborators.length} colaboradores`);
    } catch (error) {
      setSyncMessage(`✗ Error al sincronizar: ${error}`);
    }

    setSyncingAll(false);
  };

  // Sincronizar TODO desde localStorage hacia Supabase
  const handleSyncToSupabase = async () => {
    setSyncingAll(true);
    setSyncMessage('Subiendo datos a Supabase...');

    try {
      let totalSynced = 0;
      let totalErrors = 0;

      // Sincronizar impresoras
      for (const printer of printers) {
        const success = await saveToSupabase('printer', printer, 'create');
        if (success) totalSynced++;
        else totalErrors++;
      }

      // Sincronizar tóners
      for (const toner of toners) {
        const success = await saveToSupabase('toner', toner, 'create');
        if (success) totalSynced++;
        else totalErrors++;
      }

      // Sincronizar equipos
      for (const equipment of equipments) {
        const success = await saveToSupabase('equipment', equipment, 'create');
        if (success) totalSynced++;
        else totalErrors++;
      }

      // Sincronizar proveedores
      for (const supplier of suppliers) {
        const success = await saveToSupabase('supplier', supplier, 'create');
        if (success) totalSynced++;
        else totalErrors++;
      }

      // Sincronizar colaboradores
      for (const collaborator of collaborators) {
        const success = await saveToSupabase('collaborator', collaborator, 'create');
        if (success) totalSynced++;
        else totalErrors++;
      }

      // Sincronizar comprobantes
      for (const voucher of vouchers) {
        const success = await saveToSupabase('voucher', voucher, 'create');
        if (success) totalSynced++;
        else totalErrors++;
      }

      if (totalErrors === 0) {
        setSyncMessage(`✓ ${totalSynced} registros sincronizados con Supabase`);
      } else {
        setSyncMessage(`⚠ ${totalSynced} sincronizados, ${totalErrors} errores`);
      }
    } catch (error) {
      setSyncMessage(`✗ Error al sincronizar: ${error}`);
    }

    setSyncingAll(false);
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
            <Database className="w-6 h-6 text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-gray-900 dark:text-white">
              Panel de Sincronización
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Gestiona la sincronización entre tu navegador y Supabase
            </p>
          </div>
        </div>
        
        {/* Indicador de conexión */}
        <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium ${
          isConnected 
            ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400' 
            : 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400'
        }`}>
          {isConnected ? (
            <>
              <Cloud className="w-4 h-4" />
              Conectado
            </>
          ) : (
            <>
              <CloudOff className="w-4 h-4" />
              Desconectado
            </>
          )}
        </div>
      </div>

      {/* Estadísticas de datos locales */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
        <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-3 text-center">
          <p className="text-2xl font-bold text-gray-900 dark:text-white">{printers.length}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400">Impresoras</p>
        </div>
        <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-3 text-center">
          <p className="text-2xl font-bold text-gray-900 dark:text-white">{toners.length}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400">Tóners</p>
        </div>
        <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-3 text-center">
          <p className="text-2xl font-bold text-gray-900 dark:text-white">{equipments.length}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400">Equipos</p>
        </div>
        <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-3 text-center">
          <p className="text-2xl font-bold text-gray-900 dark:text-white">{suppliers.length}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400">Proveedores</p>
        </div>
        <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-3 text-center">
          <p className="text-2xl font-bold text-gray-900 dark:text-white">{collaborators.length}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400">Colaboradores</p>
        </div>
        <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-3 text-center">
          <p className="text-2xl font-bold text-gray-900 dark:text-white">{vouchers.length}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400">Comprobantes</p>
        </div>
      </div>

      {/* Botones de sincronización */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        <button
          onClick={handleSyncFromSupabase}
          disabled={syncingAll || !isConnected}
          className="flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium transition-colors"
        >
          {syncingAll ? (
            <>
              <RefreshCw className="w-5 h-5 animate-spin" />
              Sincronizando...
            </>
          ) : (
            <>
              <Download className="w-5 h-5" />
              Descargar desde Supabase
            </>
          )}
        </button>

        <button
          onClick={handleSyncToSupabase}
          disabled={syncingAll || !isConnected}
          className="flex items-center justify-center gap-2 px-4 py-3 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium transition-colors"
        >
          {syncingAll ? (
            <>
              <RefreshCw className="w-5 h-5 animate-spin" />
              Sincronizando...
            </>
          ) : (
            <>
              <Upload className="w-5 h-5" />
              Subir a Supabase
            </>
          )}
        </button>
      </div>

      {/* Mensaje de estado */}
      {(syncMessage || lastSyncMessage) && (
        <div className={`p-4 rounded-xl border-2 ${
          syncMessage?.includes('✓') || lastSyncMessage?.includes('sincronizado correctamente')
            ? 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800'
            : syncMessage?.includes('⚠')
            ? 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800'
            : syncMessage?.includes('✗') || lastSyncMessage?.includes('Error')
            ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
            : 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800'
        }`}>
          <div className="flex items-start gap-2">
            {syncMessage?.includes('✓') || lastSyncMessage?.includes('correctamente') ? (
              <CheckCircle className="text-emerald-600 dark:text-emerald-400 flex-shrink-0" size={20} />
            ) : syncMessage?.includes('⚠') ? (
              <AlertCircle className="text-amber-600 dark:text-amber-400 flex-shrink-0" size={20} />
            ) : syncMessage?.includes('✗') || lastSyncMessage?.includes('Error') ? (
              <AlertCircle className="text-red-600 dark:text-red-400 flex-shrink-0" size={20} />
            ) : (
              <RefreshCw className="text-blue-600 dark:text-blue-400 flex-shrink-0 animate-spin" size={20} />
            )}
            <p className={`text-sm ${
              syncMessage?.includes('✓') || lastSyncMessage?.includes('correctamente')
                ? 'text-emerald-700 dark:text-emerald-300'
                : syncMessage?.includes('⚠')
                ? 'text-amber-700 dark:text-amber-300'
                : syncMessage?.includes('✗') || lastSyncMessage?.includes('Error')
                ? 'text-red-700 dark:text-red-300'
                : 'text-blue-700 dark:text-blue-300'
            }`}>
              {syncMessage || lastSyncMessage}
            </p>
          </div>
        </div>
      )}

      {/* Información adicional */}
      <div className="mt-4 p-4 bg-gray-50 dark:bg-gray-700 rounded-xl">
        <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
          💡 ¿Cómo funciona?
        </h4>
        <ul className="text-xs text-gray-600 dark:text-gray-400 space-y-1 list-disc list-inside">
          <li><strong>Descargar desde Supabase:</strong> Trae todos los datos de la nube a tu navegador</li>
          <li><strong>Subir a Supabase:</strong> Envía todos los datos de tu navegador a la nube</li>
          <li>Los cambios locales (crear, editar, eliminar) se guardan automáticamente en Supabase</li>
          <li>Si no hay conexión a Supabase, los datos se guardan solo en tu navegador</li>
        </ul>
      </div>
    </div>
  );
}
