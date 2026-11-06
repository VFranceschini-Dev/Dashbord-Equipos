import React, { createContext, useContext, useState, useEffect, useCallback, useRef, ReactNode } from 'react';
import { Printer, TonerItem, Movement, Alert, Page, Equipment, Supplier, Voucher } from '../types';
import { useAuth } from './AuthContext';
import {
  syncAllFromSupabase,
  loadModuleFromSupabase,
  ModuleKey,
  syncPrinterToSupabase, deletePrinterFromSupabase,
  syncTonerToSupabase, deleteTonerFromSupabase,
  syncMovementToSupabase,
  syncEquipmentToSupabase, deleteEquipmentFromSupabase,
  syncSupplierToSupabase, deleteSupplierFromSupabase,
  syncVoucherToSupabase, deleteVoucherFromSupabase,
} from '../services/supabaseSync';

interface AppContextType {
  currentPage: Page;
  setCurrentPage: (page: Page) => void;
  // Estado de carga/errores de datos desde Supabase
  dataLoading: { global: boolean; module: ModuleKey | null };
  moduleErrors: Partial<Record<ModuleKey, string>>;
  refreshModule: (module: ModuleKey) => Promise<void>;
  /** Recarga uno o todos los módulos desde Supabase (alias solicitado: reload). */
  reload: (modulo?: ModuleKey) => Promise<void>;
  printers: Printer[];
  setPrinters: React.Dispatch<React.SetStateAction<Printer[]>>;
  addPrinter: (printer: Omit<Printer, 'id'>) => Promise<boolean>;
  updatePrinter: (id: string, data: Partial<Printer>) => Promise<boolean>;
  deletePrinter: (id: string) => Promise<boolean>;
  toners: TonerItem[];
  setToners: React.Dispatch<React.SetStateAction<TonerItem[]>>;
  addToner: (toner: Omit<TonerItem, 'id'>) => Promise<boolean>;
  updateToner: (id: string, data: Partial<TonerItem>) => Promise<boolean>;
  deleteToner: (id: string) => Promise<boolean>;
  movements: Movement[];
  setMovements: React.Dispatch<React.SetStateAction<Movement[]>>;
  addMovement: (movement: Omit<Movement, 'id'>) => Promise<boolean>;
  alerts: Alert[];
  setAlerts: React.Dispatch<React.SetStateAction<Alert[]>>;
  markAlertRead: (id: string) => void;
  unreadAlerts: number;
  equipments: Equipment[];
  setEquipments: React.Dispatch<React.SetStateAction<Equipment[]>>;
  addEquipment: (equipment: Omit<Equipment, 'id'>) => Promise<boolean>;
  updateEquipment: (id: string, data: Partial<Equipment>) => Promise<boolean>;
  deleteEquipment: (id: string) => Promise<boolean>;
  suppliers: Supplier[];
  setSuppliers: React.Dispatch<React.SetStateAction<Supplier[]>>;
  addSupplier: (supplier: Omit<Supplier, 'id'>) => Promise<boolean>;
  updateSupplier: (id: string, data: Partial<Supplier>) => Promise<boolean>;
  deleteSupplier: (id: string) => Promise<boolean>;
  vouchers: Voucher[];
  setVouchers: React.Dispatch<React.SetStateAction<Voucher[]>>;
  addVoucher: (voucher: Omit<Voucher, 'id'>) => Promise<boolean>;
  updateVoucher: (id: string, data: Partial<Voucher>) => Promise<boolean>;
  deleteVoucher: (id: string) => Promise<boolean>;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export function AppProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [currentPage, setCurrentPage] = useState<Page>('dashboard');
  // Estados arrancan vacíos: se cargan desde Supabase al iniciar sesión.
  const [printers, setPrinters] = useState<Printer[]>([]);
  const [toners, setToners] = useState<TonerItem[]>([]);
  const [movements, setMovements] = useState<Movement[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [equipments, setEquipments] = useState<Equipment[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [vouchers, setVouchers] = useState<Voucher[]>([]);

  const [dataLoading, setDataLoading] = useState<{ global: boolean; module: ModuleKey | null }>({ global: true, module: null });
  const [moduleErrors, setModuleErrors] = useState<Partial<Record<ModuleKey, string>>>({});

  // Evita carreras si cambia el usuario mientras una carga está en vuelo.
  const loadSeq = useRef(0);

  const applyAllData = useCallback((data: Awaited<ReturnType<typeof syncAllFromSupabase>>) => {
    setPrinters(data.printers);
    setToners(data.toners);
    setMovements(data.movements);
    setEquipments(data.equipments);
    setSuppliers(data.suppliers);
    setVouchers(data.vouchers);
    setModuleErrors(data.errors || {});
  }, []);

  // Carga inicial: cuando hay sesión iniciada (o cambia de usuario), leer todos
  // los módulos desde Supabase en paralelo. Al cerrar sesión, limpiar memoria.
  useEffect(() => {
    if (!user) {
      // Cierre de sesión: limpiar datos en memoria y estado de carga.
      loadSeq.current += 1;
      setPrinters([]);
      setToners([]);
      setMovements([]);
      setAlerts([]);
      setEquipments([]);
      setSuppliers([]);
      setVouchers([]);
      setModuleErrors({});
      setDataLoading({ global: false, module: null });
      return;
    }

    const seq = ++loadSeq.current;
    setDataLoading({ global: true, module: null });
    setModuleErrors({});

    syncAllFromSupabase()
      .then(data => {
        if (seq !== loadSeq.current) return; // el usuario cambió; descartar
        applyAllData(data);
      })
      .catch(error => {
        console.error('Error al cargar los datos:', error);
        if (seq === loadSeq.current) {
          setModuleErrors({ printers: 'No se pudieron cargar los datos. Intentá de nuevo más tarde' });
        }
      })
      .finally(() => {
        if (seq === loadSeq.current) setDataLoading(prev => ({ ...prev, global: false }));
      });
  }, [user?.id, applyAllData]);

  // Recarga de un solo módulo (botón "Actualizar" de cada pantalla).
  const refreshModule = useCallback(async (module: ModuleKey) => {
    if (!user) return;
    const seq = loadSeq.current;
    setDataLoading(prev => ({ ...prev, module }));
    try {
      // Carga tipada por módulo: el switch de abajo necesita acceso a los setters específicos.
      const result = await (async () => {
        switch (module) {
          case 'printers': return loadModuleFromSupabase('printers');
          case 'toners': return loadModuleFromSupabase('toners');
          case 'movements': return loadModuleFromSupabase('movements');
          case 'equipments': return loadModuleFromSupabase('equipments');
          case 'suppliers': return loadModuleFromSupabase('suppliers');
          case 'vouchers': return loadModuleFromSupabase('vouchers');
        }
      })();
      if (seq !== loadSeq.current) return;
      const data = result.data as unknown;
      switch (module) {
        case 'printers': setPrinters(data as Printer[]); break;
        case 'toners': setToners(data as TonerItem[]); break;
        case 'movements': setMovements(data as Movement[]); break;
        case 'equipments': setEquipments(data as Equipment[]); break;
        case 'suppliers': setSuppliers(data as Supplier[]); break;
        case 'vouchers': setVouchers(data as Voucher[]); break;
      }
      setModuleErrors(prev => {
        const next = { ...prev };
        if (result.error) next[module] = result.error;
        else delete next[module];
        return next;
      });
    } catch (error) {
      console.error(`Error al actualizar el módulo ${module}:`, error);
      if (seq === loadSeq.current) {
        setModuleErrors(prev => ({ ...prev, [module]: 'No se pudieron actualizar los datos. Intentá de nuevo más tarde' }));
      }
    } finally {
      if (seq === loadSeq.current) setDataLoading(prev => ({ ...prev, module: null }));
    }
  }, [user]);

  // Recarga uno o todos los módulos desde Supabase (sin recargar la página).
  const reload = useCallback(async (modulo?: ModuleKey) => {
    if (!user) return;
    if (modulo) {
      await refreshModule(modulo);
      return;
    }
    const seq = ++loadSeq.current;
    setDataLoading({ global: true, module: null });
    setModuleErrors({});
    try {
      const data = await syncAllFromSupabase();
      if (seq !== loadSeq.current) return;
      applyAllData(data);
    } catch (error) {
      console.error('Error al recargar los datos:', error);
      if (seq === loadSeq.current) {
        setModuleErrors({ printers: 'No se pudieron cargar los datos. Intentá de nuevo más tarde' });
      }
    } finally {
      if (seq === loadSeq.current) setDataLoading(prev => ({ ...prev, global: false }));
    }
  }, [user, refreshModule, applyAllData]);

  // Altas, ediciones y borrados: primero se guardan en Supabase y recién
  // después se reflejan en pantalla. Si falla, el aviso queda en moduleErrors
  // (lo muestra ModuleSyncControls) y la pantalla no cambia.
  const registrarResultado = (module: ModuleKey, ok: boolean, accion: string): boolean => {
    setModuleErrors(prev => {
      const next = { ...prev };
      if (ok) delete next[module];
      else next[module] = `No se pudo ${accion}. Intentá de nuevo más tarde`;
      return next;
    });
    return ok;
  };

  // El id lo asigna la base: se descarta cualquier id que venga (p. ej. de una importación).
  const addPrinter = async (printer: Omit<Printer, 'id'>) => {
    const item = { ...printer, id: '' } as Printer;
    const { success } = await syncPrinterToSupabase(item);
    if (success) setPrinters(prev => [...prev, item]);
    return registrarResultado('printers', success, 'guardar la impresora');
  };
  const updatePrinter = async (id: string, data: Partial<Printer>) => {
    const actual = printers.find(p => p.id === id);
    if (!actual) return false;
    const item = { ...actual, ...data, id };
    const { success } = await syncPrinterToSupabase(item);
    if (success) setPrinters(prev => prev.map(p => p.id === id ? item : p));
    return registrarResultado('printers', success, 'actualizar la impresora');
  };
  const deletePrinter = async (id: string) => {
    const { success } = await deletePrinterFromSupabase(id);
    if (success) setPrinters(prev => prev.filter(p => p.id !== id));
    return registrarResultado('printers', success, 'eliminar la impresora');
  };

  const addToner = async (toner: Omit<TonerItem, 'id'>) => {
    const item = { ...toner, id: '' } as TonerItem;
    const ok = await syncTonerToSupabase(item);
    if (ok) setToners(prev => [...prev, item]);
    return registrarResultado('toners', ok, 'guardar el tóner');
  };
  const updateToner = async (id: string, data: Partial<TonerItem>) => {
    const actual = toners.find(t => t.id === id);
    if (!actual) return false;
    const item = { ...actual, ...data, id };
    const ok = await syncTonerToSupabase(item);
    if (ok) setToners(prev => prev.map(t => t.id === id ? item : t));
    return registrarResultado('toners', ok, 'actualizar el tóner');
  };
  const deleteToner = async (id: string) => {
    const ok = await deleteTonerFromSupabase(id);
    if (ok) setToners(prev => prev.filter(t => t.id !== id));
    return registrarResultado('toners', ok, 'eliminar el tóner');
  };

  const addMovement = async (movement: Omit<Movement, 'id'>) => {
    const item = { ...movement, id: '' } as Movement;
    const ok = await syncMovementToSupabase(item);
    if (ok) setMovements(prev => [item, ...prev]);
    return registrarResultado('movements', ok, 'guardar el movimiento');
  };

  const markAlertRead = (id: string) => {
    setAlerts(prev => prev.map(a => a.id === id ? { ...a, read: true } : a));
  };
  const unreadAlerts = alerts.filter(a => !a.read).length;

  const addEquipment = async (equipment: Omit<Equipment, 'id'>) => {
    const item = { ...equipment, id: '' } as Equipment;
    const ok = await syncEquipmentToSupabase(item);
    if (ok) setEquipments(prev => [...prev, item]);
    return registrarResultado('equipments', ok, 'guardar el equipo');
  };
  const updateEquipment = async (id: string, data: Partial<Equipment>) => {
    const actual = equipments.find(e => e.id === id);
    if (!actual) return false;
    const item = { ...actual, ...data, id };
    const ok = await syncEquipmentToSupabase(item);
    if (ok) setEquipments(prev => prev.map(e => e.id === id ? item : e));
    return registrarResultado('equipments', ok, 'actualizar el equipo');
  };
  const deleteEquipment = async (id: string) => {
    const ok = await deleteEquipmentFromSupabase(id);
    if (ok) setEquipments(prev => prev.filter(e => e.id !== id));
    return registrarResultado('equipments', ok, 'eliminar el equipo');
  };

  const addSupplier = async (supplier: Omit<Supplier, 'id'>) => {
    const item = { ...supplier, id: '' } as Supplier;
    const ok = await syncSupplierToSupabase(item);
    if (ok) setSuppliers(prev => [...prev, item]);
    return registrarResultado('suppliers', ok, 'guardar el proveedor');
  };
  const updateSupplier = async (id: string, data: Partial<Supplier>) => {
    const actual = suppliers.find(s => s.id === id);
    if (!actual) return false;
    const item = { ...actual, ...data, id };
    const ok = await syncSupplierToSupabase(item);
    if (ok) setSuppliers(prev => prev.map(s => s.id === id ? item : s));
    return registrarResultado('suppliers', ok, 'actualizar el proveedor');
  };
  const deleteSupplier = async (id: string) => {
    const ok = await deleteSupplierFromSupabase(id);
    if (ok) setSuppliers(prev => prev.filter(s => s.id !== id));
    return registrarResultado('suppliers', ok, 'eliminar el proveedor');
  };

  const addVoucher = async (voucher: Omit<Voucher, 'id'>) => {
    const item = { ...voucher, id: '' } as Voucher;
    const ok = await syncVoucherToSupabase(item);
    if (ok) setVouchers(prev => [...prev, item]);
    return registrarResultado('vouchers', ok, 'guardar el comprobante');
  };
  const updateVoucher = async (id: string, data: Partial<Voucher>) => {
    const actual = vouchers.find(v => v.id === id);
    if (!actual) return false;
    const item = { ...actual, ...data, id };
    const ok = await syncVoucherToSupabase(item);
    if (ok) setVouchers(prev => prev.map(v => v.id === id ? item : v));
    return registrarResultado('vouchers', ok, 'actualizar el comprobante');
  };
  const deleteVoucher = async (id: string) => {
    const ok = await deleteVoucherFromSupabase(id);
    if (ok) setVouchers(prev => prev.filter(v => v.id !== id));
    return registrarResultado('vouchers', ok, 'eliminar el comprobante');
  };

  return (
    <AppContext.Provider value={{
      currentPage, setCurrentPage,
      dataLoading, moduleErrors, refreshModule, reload,
      printers, setPrinters, addPrinter, updatePrinter, deletePrinter,
      toners, setToners, addToner, updateToner, deleteToner,
      movements, setMovements, addMovement,
      alerts, setAlerts, markAlertRead, unreadAlerts,
      equipments, setEquipments, addEquipment, updateEquipment, deleteEquipment,
      suppliers, setSuppliers, addSupplier, updateSupplier, deleteSupplier,
      vouchers, setVouchers, addVoucher, updateVoucher, deleteVoucher,
    }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const context = useContext(AppContext);
  if (!context) throw new Error('useApp must be used within AppProvider');
  return context;
}