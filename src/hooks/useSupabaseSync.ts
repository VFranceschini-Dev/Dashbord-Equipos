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
    setLastSyncMessage(`Sincronizando ${type}...`);

    try {
      let success = false;

      switch (type) {
        case 'printer':
          if (action === 'delete') {
            success = await deletePrinterFromSupabase(data.id);
          } else {
            success = await syncPrinterToSupabase(data as Printer);
          }
          break;
        case 'toner':
          if (action === 'delete') {
            success = await deleteTonerFromSupabase(data.id);
          } else {
            success = await syncTonerToSupabase(data as TonerItem);
          }
          break;
        case 'equipment':
          if (action === 'delete') {
            success = await deleteEquipmentFromSupabase(data.id);
          } else {
            success = await syncEquipmentToSupabase(data as Equipment);
          }
          break;
        case 'supplier':
          if (action === 'delete') {
            success = await deleteSupplierFromSupabase(data.id);
          } else {
            success = await syncSupplierToSupabase(data as Supplier);
          }
          break;
        case 'collaborator':
          if (action === 'delete') {
            success = await deleteCollaboratorFromSupabase(data.id);
          } else {
            success = await syncCollaboratorToSupabase(data as Collaborator);
          }
          break;
        case 'voucher':
          if (action === 'delete') {
            success = await deleteVoucherFromSupabase(data.id);
          } else {
            success = await syncVoucherToSupabase(data as Voucher);
          }
          break;
        default:
          throw new Error(`Tipo de entidad no soportado: ${type}`);
      }

      if (success) {
        setSyncStatus('success');
        setLastSyncMessage(`${type} sincronizado correctamente`);
      } else {
        setSyncStatus('error');
        setLastSyncMessage(`Error al sincronizar ${type}`);
      }

      return success;
    } catch (error) {
      setSyncStatus('error');
      setLastSyncMessage(`Error: ${error}`);
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
