import { useState, useCallback } from 'react';
import {
  syncPrinterToSupabase, deletePrinterFromSupabase,
  syncTonerToSupabase, deleteTonerFromSupabase,
  syncEquipmentToSupabase, deleteEquipmentFromSupabase,
  syncSupplierToSupabase, deleteSupplierFromSupabase,
  syncCollaboratorToSupabase, deleteCollaboratorFromSupabase,
  syncVoucherToSupabase, deleteVoucherFromSupabase,
  checkSupabaseConnection
} from '../services/supabaseSync';
import { Printer, TonerItem, Equipment, Supplier, Collaborator, Voucher } from '../types';

export type SyncStatus = 'idle' | 'syncing' | 'success' | 'error';

// Tipo común para los datos que recibe saveToSupabase: todo registro sincronizable
// tiene al menos un `id` string (necesario para las acciones de borrado).
export type SyncData = { id: string } & Record<string, unknown>;

// Resultado unificado de las funciones sync*/delete* de supabaseSync:
// algunas devuelven { success, error? } y otras devuelven boolean.
type SyncResult = boolean | { success: boolean; error?: string };

interface UseSupabaseSyncReturn {
  isConnected: boolean;
  syncStatus: SyncStatus;
  lastSyncMessage: string;
  checkConnection: () => Promise<boolean>;
  saveToSupabase: (type: string, data: SyncData, action: 'create' | 'update' | 'delete') => Promise<boolean>;
}

export function useSupabaseSync(): UseSupabaseSyncReturn {
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('idle');
  const [lastSyncMessage, setLastSyncMessage] = useState<string>('');

  const checkConnection = useCallback(async () => {
    const connected = await checkSupabaseConnection();
    setIsConnected(connected);
    return connected;
  }, []);

  const saveToSupabase = useCallback(async (
    type: string,
    data: SyncData,
    action: 'create' | 'update' | 'delete'
  ): Promise<boolean> => {
    setSyncStatus('syncing');
    setLastSyncMessage('Procesando...');

    try {
      let result: SyncResult;

      switch (type) {
        case 'printer':
          if (action === 'delete') {
            result = await deletePrinterFromSupabase(data.id);
          } else {
            result = await syncPrinterToSupabase(data as unknown as Printer);
          }
          break;
        case 'toner':
          if (action === 'delete') {
            result = await deleteTonerFromSupabase(data.id);
          } else {
            result = await syncTonerToSupabase(data as unknown as TonerItem);
          }
          break;
        case 'equipment':
          if (action === 'delete') {
            result = await deleteEquipmentFromSupabase(data.id);
          } else {
            result = await syncEquipmentToSupabase(data as unknown as Equipment);
          }
          break;
        case 'supplier':
          if (action === 'delete') {
            result = await deleteSupplierFromSupabase(data.id);
          } else {
            result = await syncSupplierToSupabase(data as unknown as Supplier);
          }
          break;
        case 'collaborator':
          if (action === 'delete') {
            result = await deleteCollaboratorFromSupabase(data.id);
          } else {
            result = await syncCollaboratorToSupabase(data as unknown as Collaborator);
          }
          break;
        case 'voucher':
          if (action === 'delete') {
            result = await deleteVoucherFromSupabase(data.id);
          } else {
            result = await syncVoucherToSupabase(data as unknown as Voucher);
          }
          break;
        default:
          throw new Error('Operación no soportada');
      }

      // Normalización del resultado: boolean o { success, error? }
      const success = typeof result === 'boolean' ? result : result.success;
      const errorMessage = typeof result === 'boolean' ? undefined : result.error;

      if (success) {
        setSyncStatus('success');
        setLastSyncMessage('Datos guardados correctamente');
      } else {
        setSyncStatus('error');
        setLastSyncMessage(errorMessage || 'Error al guardar los datos');
      }

      return success;
    } catch (error) {
      setSyncStatus('error');
      setLastSyncMessage('Error al guardar los datos');
      return false;
    }
  }, []);

  return {
    isConnected,
    syncStatus,
    lastSyncMessage,
    checkConnection,
    saveToSupabase,
  };
}
