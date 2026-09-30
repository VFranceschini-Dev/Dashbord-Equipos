import React, { createContext, useContext, useState, ReactNode } from 'react';
import { Printer, TonerItem, Movement, Alert, Page } from '../types';
import { initialPrinters, initialToners, initialMovements, initialAlerts } from '../data';
import { v4 as uuidv4 } from 'uuid';

interface AppContextType {
  currentPage: Page;
  setCurrentPage: (page: Page) => void;
  printers: Printer[];
  setPrinters: React.Dispatch<React.SetStateAction<Printer[]>>;
  toners: TonerItem[];
  setToners: React.Dispatch<React.SetStateAction<TonerItem[]>>;
  movements: Movement[];
  setMovements: React.Dispatch<React.SetStateAction<Movement[]>>;
  alerts: Alert[];
  setAlerts: React.Dispatch<React.SetStateAction<Alert[]>>;
  addPrinter: (printer: Omit<Printer, 'id'>) => void;
  updatePrinter: (id: string, printer: Partial<Printer>) => void;
  deletePrinter: (id: string) => void;
  addToner: (toner: Omit<TonerItem, 'id'>) => void;
  updateToner: (id: string, toner: Partial<TonerItem>) => void;
  deleteToner: (id: string) => void;
  addMovement: (movement: Omit<Movement, 'id'>) => void;
  markAlertRead: (id: string) => void;
  unreadAlerts: number;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export function AppProvider({ children }: { children: ReactNode }) {
  const [currentPage, setCurrentPage] = useState<Page>('dashboard');
  const [printers, setPrinters] = useState<Printer[]>(initialPrinters);
  const [toners, setToners] = useState<TonerItem[]>(initialToners);
  const [movements, setMovements] = useState<Movement[]>(initialMovements);
  const [alerts, setAlerts] = useState<Alert[]>(initialAlerts);

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

  return (
    <AppContext.Provider value={{
      currentPage, setCurrentPage,
      printers, setPrinters, addPrinter, updatePrinter, deletePrinter,
      toners, setToners, addToner, updateToner, deleteToner,
      movements, setMovements, addMovement,
      alerts, setAlerts, markAlertRead, unreadAlerts,
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
