import React, { createContext, useContext, useState, useEffect, useCallback, useRef, ReactNode } from 'react';
import { Printer, TonerItem, Movement, Alert, Page, Equipment, Supplier, Collaborator, Voucher } from '../types';
import { useAuth } from './AuthContext';
import {
  syncAllFromSupabase,
  loadModuleFromSupabase,
  ModuleKey,
} from '../services/supabaseSync';
import { v4 as uuidv4 } from 'uuid';

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
  addPrinter: (printer: Omit<Printer, 'id'>) => void;
  updatePrinter: (id: string, data: Partial<Printer>) => void;
  deletePrinter: (id: string) => void;
  toners: TonerItem[];
  setToners: React.Dispatch<React.SetStateAction<TonerItem[]>>;
  addToner: (toner: Omit<TonerItem, 'id'>) => void;
  updateToner: (id: string, data: Partial<TonerItem>) => void;
  deleteToner: (id: string) => void;
  movements: Movement[];
  setMovements: React.Dispatch<React.SetStateAction<Movement[]>>;
  addMovement: (movement: Omit<Movement, 'id'>) => void;
  alerts: Alert[];
  setAlerts: React.Dispatch<React.SetStateAction<Alert[]>>;
  markAlertRead: (id: string) => void;
  unreadAlerts: number;
  equipments: Equipment[];
  setEquipments: React.Dispatch<React.SetStateAction<Equipment[]>>;
  addEquipment: (equipment: Omit<Equipment, 'id'>) => void;
  updateEquipment: (id: string, data: Partial<Equipment>) => void;
  deleteEquipment: (id: string) => void;
  suppliers: Supplier[];
  setSuppliers: React.Dispatch<React.SetStateAction<Supplier[]>>;
  addSupplier: (supplier: Omit<Supplier, 'id'>) => void;
  updateSupplier: (id: string, data: Partial<Supplier>) => void;
  deleteSupplier: (id: string) => void;
  collaborators: Collaborator[];
  setCollaborators: React.Dispatch<React.SetStateAction<Collaborator[]>>;
  addCollaborator: (collaborator: Omit<Collaborator, 'id'>) => void;
  updateCollaborator: (id: string, data: Partial<Collaborator>) => void;
  deleteCollaborator: (id: string) => void;
  vouchers: Voucher[];
  setVouchers: React.Dispatch<React.SetStateAction<Voucher[]>>;
  addVoucher: (voucher: Omit<Voucher, 'id'>) => void;
  updateVoucher: (id: string, data: Partial<Voucher>) => void;
  deleteVoucher: (id: string) => void;
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
  const [collaborators, setCollaborators] = useState<Collaborator[]>([]);
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
    setCollaborators(data.collaborators);
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
      setCollaborators([]);
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
          case 'collaborators': return loadModuleFromSupabase('collaborators');
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
        case 'collaborators': setCollaborators(data as Collaborator[]); break;
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

  const addPrinter = (printer: Omit<Printer, 'id'>) => {
    setPrinters(prev => [...prev, { ...printer, id: uuidv4() }]);
  };
  const updatePrinter = (id: string, data: Partial<Printer>) => {
    setPrinters(prev => prev.map(p => p.id === id ? { ...p, ...data } : p));
  };
  const deletePrinter = (id: string) => {
    setPrinters(prev => prev.filter(p => p.id !== id));
  };

  const addToner = (toner: Omit<TonerItem, 'id'>) => {
    setToners(prev => [...prev, { ...toner, id: uuidv4() }]);
  };
  const updateToner = (id: string, data: Partial<TonerItem>) => {
    setToners(prev => prev.map(t => t.id === id ? { ...t, ...data } : t));
  };
  const deleteToner = (id: string) => {
    setToners(prev => prev.filter(t => t.id !== id));
  };

  const addMovement = (movement: Omit<Movement, 'id'>) => {
    setMovements(prev => [{ ...movement, id: uuidv4() }, ...prev]);
  };

  const markAlertRead = (id: string) => {
    setAlerts(prev => prev.map(a => a.id === id ? { ...a, read: true } : a));
  };
  const unreadAlerts = alerts.filter(a => !a.read).length;

  const addEquipment = (equipment: Omit<Equipment, 'id'>) => {
    setEquipments(prev => [...prev, { ...equipment, id: uuidv4() }]);
  };
  const updateEquipment = (id: string, data: Partial<Equipment>) => {
    setEquipments(prev => prev.map(e => e.id === id ? { ...e, ...data } : e));
  };
  const deleteEquipment = (id: string) => {
    setEquipments(prev => prev.filter(e => e.id !== id));
  };

  const addSupplier = (supplier: Omit<Supplier, 'id'>) => {
    setSuppliers(prev => [...prev, { ...supplier, id: uuidv4() }]);
  };
  const updateSupplier = (id: string, data: Partial<Supplier>) => {
    setSuppliers(prev => prev.map(s => s.id === id ? { ...s, ...data } : s));
  };
  const deleteSupplier = (id: string) => {
    setSuppliers(prev => prev.filter(s => s.id !== id));
  };

  const addCollaborator = (collaborator: Omit<Collaborator, 'id'>) => {
    setCollaborators(prev => [...prev, { ...collaborator, id: uuidv4() }]);
  };
  const updateCollaborator = (id: string, data: Partial<Collaborator>) => {
    setCollaborators(prev => prev.map(c => c.id === id ? { ...c, ...data } : c));
  };
  const deleteCollaborator = (id: string) => {
    setCollaborators(prev => prev.filter(c => c.id !== id));
  };

  const addVoucher = (voucher: Omit<Voucher, 'id'>) => {
    setVouchers(prev => [...prev, { ...voucher, id: uuidv4() }]);
  };
  const updateVoucher = (id: string, data: Partial<Voucher>) => {
    setVouchers(prev => prev.map(v => v.id === id ? { ...v, ...data } : v));
  };
  const deleteVoucher = (id: string) => {
    setVouchers(prev => prev.filter(v => v.id !== id));
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
      collaborators, setCollaborators, addCollaborator, updateCollaborator, deleteCollaborator,
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