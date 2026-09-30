import { Printer, TonerItem, Movement, Alert } from './types';
import { v4 as uuidv4 } from 'uuid';

// Datos iniciales vacíos - Listos para integrar con backend real
export const initialPrinters: Printer[] = [];

export const initialToners: TonerItem[] = [];

export const initialMovements: Movement[] = [];

export const initialAlerts: Alert[] = [];

// Configuración de MeshCentral
export const MESH_CONFIG = {
  baseUrl: 'https://mesh.donnet.com.ar',
  apiEndpoint: '/api',
  refreshInterval: 30000, // 30 segundos
};
