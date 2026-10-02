import React, { createContext, useContext, useState, ReactNode } from 'react';
import { Printer, TonerItem, Movement, Alert, Page, Equipment, Supplier, Collaborator, Voucher } from '../types';
import { initialPrinters, initialToners, initialMovements, initialAlerts, initialEquipments, initialSuppliers, initialCollaborators, initialVouchers } from '../data';
import { v4 as uuidv4 } from 'uuid';

interface AppContextType {
  currentPage: Page;
  setCurrentPage: (page: Page) => void;
  
  // Printers
  printers: Printer[];
  setPrinters: React.Dispatch<React.SetStateAction<Printer[]>>;
  addPrinter: (printer: Omit<Printer, 'id'>) => void;
  updatePrinter: (id: string, data: Partial<Printer>) => void;
  deletePrinter: (id: string) => void;
  
  // Toners
  toners: TonerItem[];
  setToners: React.Dispatch<React.SetStateAction<TonerItem[]>>;
  addToner: (toner: Omit<TonerItem, 'id'>) => void;
  updateToner: (id: string, data: Partial<TonerItem>) => void;
  deleteToner: (id: string) => void;
  
  // Movements
  movements: Movement[];
  setMovements: React.Dispatch<React.SetStateAction<Movement[]>>;
  addMovement: (movement: Omit<Movement, 'id'>) => void;
  
  // Alerts
  alerts: Alert[];
  setAlerts: React.Dispatch<React.SetStateAction<Alert[]>>;
  markAlertRead: (id: string) => void;
  unreadAlerts: number;
  
  // Equipments (NUEVO)
  equipments: Equipment[];
  setEquipments: React.Dispatch<React.SetStateAction<Equipment[]>>;
  addEquipment: (equipment: Omit<Equipment, 'id'>) => void;
  updateEquipment: (id: string, data: Partial<Equipment>) => void;
  deleteEquipment: (id: string) => void;
  
  // Suppliers (NUEVO)
  suppliers: Supplier[];
  setSuppliers: React.Dispatch<React.SetStateAction<Supplier[]>>;
  addSupplier: (supplier: Omit<Supplier, 'id'>) => void;
  updateSupplier: (id: string, data: Partial<Supplier>) => void;
  deleteSupplier: (id: string) => void;
  
  // Collaborators (NUEVO)
  collaborators: Collaborator[];
  setCollaborators: React.Dispatch<React.SetStateAction<Collaborator[]>>;
  addCollaborator: (collaborator: Omit<Collaborator, 'id'>) => void;
  updateCollaborator: (id: string, data: Partial<Collaborator>) => void;
  deleteCollaborator: (id: string) => void;
  
  // Vouchers (NUEVO)
  vouchers: Voucher[];
  setVouchers: React.Dispatch<React.SetStateAction<Voucher[]>>;
  addVoucher: (voucher: Omit<Voucher, 'id'>) => void;
  updateVoucher: (id: string, data: Partial<Voucher>) => void;
  deleteVoucher: (id: string) => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export function AppProvider({ children }: { children: ReactNode }) {
  const [currentPage, setCurrentPage] = useState<Page>('dashboard');
  const [printers, setPrinters] = useState<Printer[]>(initialPrinters);
  const [toners, setToners] = useState<TonerItem[]>(initialToners);
  const [movements, setMovements] = useState<Movement[]>(initialMovements);
  const [alerts, setAlerts] = useState<Alert[]>(initialAlerts);
  const [equipments, setEquipments] = useState<Equipment[]>(initialEquipments);
  const [suppliers, setSuppliers] = useState<Supplier[]>(initialSuppliers);
  const [collaborators, setCollaborators] = useState<Collaborator[]>(initialCollaborators);
  const [vouchers, setVouchers] = useState<Voucher[]>(initialVouchers);

  // Printers
  const addPrinter = (printer: Omit<Printer, 'id'>) => {
    setPrinters(prev => [...prev, { ...printer, id: uuidv4() }]);
  };
  const updatePrinter = (id: string, data: Partial<Printer>) => {
    setPrinters(prev => prev.map(p => p.id === id ? { ...p, ...data } : p));
  };
  const deletePrinter = (id: string) => {
    setPrinters(prev => prev.filter(p => p.id !== id));
  };

  // Toners
  const addToner = (toner: Omit<TonerItem, 'id'>) => {
    setToners(prev => [...prev, { ...toner, id: uuidv4() }]);
  };
  const updateToner = (id: string, data: Partial<TonerItem>) => {
    setToners(prev => prev.map(t => t.id === id ? { ...t, ...data } : t));
  };
  const deleteToner = (id: string) => {
    setToners(prev => prev.filter(t => t.id !== id));
  };

  // Movements
  const addMovement = (movement: Omit<Movement, 'id'>) => {
    setMovements(prev => [{ ...movement, id: uuidv4() }, ...prev]);
  };

  // Alerts
  const markAlertRead = (id: string) => {
    setAlerts(prev => prev.map(a => a.id === id ? { ...a, read: true } : a));
  };
  const unreadAlerts = alerts.filter(a => !a.read).length;

  // Equipments
  const addEquipment = (equipment: Omit<Equipment, 'id'>) => {
    setEquipments(prev => [...prev, { ...equipment, id: uuidv4() }]);
  };
  const updateEquipment = (id: string, data: Partial<Equipment>) => {
    setEquipments(prev => prev.map(e => e.id === id ? { ...e, ...data } : e));
  };
  const deleteEquipment = (id: string) => {
    setEquipments(prev => prev.filter(e => e.id !== id));
  };

  // Suppliers
  const addSupplier = (supplier: Omit<Supplier, 'id'>) => {
    setSuppliers(prev => [...prev, { ...supplier, id: uuidv4() }]);
  };
  const updateSupplier = (id: string, data: Partial<Supplier>) => {
    setSuppliers(prev => prev.map(s => s.id === id ? { ...s, ...data } : s));
  };
  const deleteSupplier = (id: string) => {
    setSuppliers(prev => prev.filter(s => s.id !== id));
  };

  // Collaborators
  const addCollaborator = (collaborator: Omit<Collaborator, 'id'>) => {
    setCollaborators(prev => [...prev, { ...collaborator, id: uuidv4() }]);
  };
  const updateCollaborator = (id: string, data: Partial<Collaborator>) => {
    setCollaborators(prev => prev.map(c => c.id === id ? { ...c, ...data } : c));
  };
  const deleteCollaborator = (id: string) => {
    setCollaborators(prev => prev.filter(c => c.id !== id));
  };

  // Vouchers
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
