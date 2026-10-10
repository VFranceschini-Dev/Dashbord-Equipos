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

interface UseSupabaseSyncReturn {
  isConnected: boolean;
  syncStatus: SyncStatus;
  lastSyncMessage: string;
  checkConnection: () => Promise<boolean>;
  saveToSupabase: (type: string, data: any, action: 'create' | 'update' | 'delete') => Promise<boolean>;
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
    data: any, 
    action: 'create' | 'update' | 'delete'
  ): Promise<boolean> => {
    setSyncStatus('syncing');
    setLastSyncMessage('Procesando...');

    try {
      let result: { success: boolean; error?: string };

      switch (type) {
        case 'printer':
          if (action === 'delete') {
            result = await deletePrinterFromSupabase(data.id);
          } else {
            result = await syncPrinterToSupabase(data as Printer);
          }
          break;
        case 'toner':
          if (action === 'delete') {
            result = await deleteTonerFromSupabase(data.id);
          } else {
            result = await syncTonerToSupabase(data as TonerItem);
          }
          break;
        case 'equipment':
          if (action === 'delete') {
            result = await deleteEquipmentFromSupabase(data.id);
          } else {
            result = await syncEquipmentToSupabase(data as Equipment);
          }
          break;
        case 'supplier':
          if (action === 'delete') {
            result = await deleteSupplierFromSupabase(data.id);
          } else {
            result = await syncSupplierToSupabase(data as Supplier);
          }
          break;
        case 'collaborator':
          if (action === 'delete') {
            result = await deleteCollaboratorFromSupabase(data.id);
          } else {
            result = await syncCollaboratorToSupabase(data as Collaborator);
          }
          break;
        case 'voucher':
          if (action === 'delete') {
            result = await deleteVoucherFromSupabase(data.id);
          } else {
            result = await syncVoucherToSupabase(data as Voucher);
          }
          break;
        default:
          throw new Error('Operación no soportada');
      }

      if (result.success) {
        setSyncStatus('success');
        setLastSyncMessage('Datos guardados correctamente');
      } else {
        setSyncStatus('error');
        setLastSyncMessage(result.error || 'Error al guardar los datos');
      }

      return result.success;
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
