export type NotificationType = 'info' | 'success' | 'warning' | 'error';
export type NotificationCategory = 'sync' | 'connection' | 'mapping' | 'system' | 'inventory';

export interface Notification {
  id: string;
  type: NotificationType;
  category: NotificationCategory;
  title: string;
  message: string;
  timestamp: string;
  read: boolean;
  data?: any;
  action?: {
    label: string;
    callback: () => void;
  };
}

const STORAGE_KEY = 'system_notifications';
const MAX_NOTIFICATIONS = 100;

// Obtener todas las notificaciones
export function getNotifications(): Notification[] {
  const data = localStorage.getItem(STORAGE_KEY);
  return data ? JSON.parse(data) : [];
}

// Guardar notificaciones
export function saveNotifications(notifications: Notification[]): void {
  // Mantener solo las últimas MAX_NOTIFICATIONS
  const limited = notifications.slice(0, MAX_NOTIFICATIONS);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(limited));
}

// Crear nueva notificación
export function createNotification(
  type: NotificationType,
  category: NotificationCategory,
  title: string,
  message: string,
  data?: any,
  action?: { label: string; callback: () => void }
): Notification {
  const notification: Notification = {
    id: `notif-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    type,
    category,
    title,
    message,
    timestamp: new Date().toISOString(),
    read: false,
    data,
    action,
  };

  const notifications = getNotifications();
  notifications.unshift(notification); // Agregar al inicio
  saveNotifications(notifications);

  // Disparar evento personalizado para que los componentes se actualicen
  window.dispatchEvent(new CustomEvent('notification-added', { detail: notification }));

  return notification;
}

// Notificaciones predefinidas para sincronización
export function notifySyncStart(serverName: string): Notification {
  return createNotification(
    'info',
    'sync',
    'Sincronización Iniciada',
    `Iniciando sincronización con ${serverName}...`,
    { serverName }
  );
}

export function notifySyncSuccess(serverName: string, devicesCount: number): Notification {
  return createNotification(
    'success',
    'sync',
    'Sincronización Exitosa',
    `Se sincronizaron ${devicesCount} dispositivos desde ${serverName}`,
    { serverName, devicesCount }
  );
}

export function notifySyncError(serverName: string, error: string): Notification {
  return createNotification(
    'error',
    'sync',
    'Error de Sincronización',
    `Error al sincronizar con ${serverName}: ${error}`,
    { serverName, error }
  );
}

export function notifySyncPartial(serverName: string, success: number, failed: number): Notification {
  return createNotification(
    'warning',
    'sync',
    'Sincronización Parcial',
    `Sincronización con ${serverName}: ${success} exitosos, ${failed} fallidos`,
    { serverName, success, failed }
  );
}

// Notificaciones para conexión
export function notifyConnectionSuccess(serverName: string): Notification {
  return createNotification(
    'success',
    'connection',
    'Conexión Exitosa',
    `Conexión establecida con ${serverName}`,
    { serverName }
  );
}

export function notifyConnectionError(serverName: string, error: string): Notification {
  return createNotification(
    'error',
    'connection',
    'Error de Conexión',
    `No se pudo conectar con ${serverName}: ${error}`,
    { serverName, error }
  );
}

export function notifyConnectionLost(serverName: string): Notification {
  return createNotification(
    'warning',
    'connection',
    'Conexión Perdida',
    `Se perdió la conexión con ${serverName}`,
    { serverName }
  );
}

// Notificaciones para mapeo
export function notifyDeviceMapped(deviceName: string, equipmentName: string): Notification {
  return createNotification(
    'success',
    'mapping',
    'Dispositivo Mapeado',
    `${deviceName} ha sido mapeado a ${equipmentName}`,
    { deviceName, equipmentName }
  );
}

export function notifyAutoMappingCompleted(count: number): Notification {
  return createNotification(
    'info',
    'mapping',
    'Mapeo Automático Completado',
    `Se mapearon automáticamente ${count} dispositivos`,
    { count }
  );
}

// Notificaciones de inventario
export function notifyLowStockGroup(
  brand: string,
  model: string,
  color: string,
  totalStock: number,
  minStock: number,
  suppliers: string[]
): Notification {
  const colorLabel = color === 'black' ? 'Negro' :
                     color === 'cyan' ? 'Cian' :
                     color === 'magenta' ? 'Magenta' : 'Amarillo';
  
  return createNotification(
    'warning',
    'inventory',
    'Stock Bajo',
    `${brand} ${model} (${colorLabel}) - Stock total: ${totalStock} (mínimo: ${minStock}) - Proveedores: ${suppliers.join(', ')}`,
    { brand, model, color, totalStock, minStock, suppliers }
  );
}

// Notificaciones del sistema
export function notifySystemInfo(title: string, message: string): Notification {
  return createNotification('info', 'system', title, message);
}

export function notifySystemSuccess(title: string, message: string): Notification {
  return createNotification('success', 'system', title, message);
}

export function notifySystemWarning(title: string, message: string): Notification {
  return createNotification('warning', 'system', title, message);
}

export function notifySystemError(title: string, message: string): Notification {
  return createNotification('error', 'system', title, message);
}

// Marcar notificación como leída
export function markAsRead(notificationId: string): void {
  const notifications = getNotifications();
  const index = notifications.findIndex(n => n.id === notificationId);

  if (index !== -1) {
    notifications[index].read = true;
    saveNotifications(notifications);
  }
}

// Marcar todas como leídas
export function markAllAsRead(): void {
  const notifications = getNotifications();
  notifications.forEach(n => {
    n.read = true;
  });
  saveNotifications(notifications);
}

// Eliminar notificación
export function deleteNotification(notificationId: string): void {
  const notifications = getNotifications();
  const filtered = notifications.filter(n => n.id !== notificationId);
  saveNotifications(filtered);
}

// Eliminar todas las notificaciones
export function clearAllNotifications(): void {
  saveNotifications([]);
}

// Obtener notificaciones no leídas
export function getUnreadNotifications(): Notification[] {
  return getNotifications().filter(n => !n.read);
}

// Obtener notificaciones por categoría
export function getNotificationsByCategory(category: NotificationCategory): Notification[] {
  return getNotifications().filter(n => n.category === category);
}

// Obtener notificaciones por tipo
export function getNotificationsByType(type: NotificationType): Notification[] {
  return getNotifications().filter(n => n.type === type);
}

// Obtener estadísticas de notificaciones
export function getNotificationStats() {
  const notifications = getNotifications();

  return {
    total: notifications.length,
    unread: notifications.filter(n => !n.read).length,
    byType: {
      info: notifications.filter(n => n.type === 'info').length,
      success: notifications.filter(n => n.type === 'success').length,
      warning: notifications.filter(n => n.type === 'warning').length,
      error: notifications.filter(n => n.type === 'error').length,
    },
    byCategory: {
      sync: notifications.filter(n => n.category === 'sync').length,
      connection: notifications.filter(n => n.category === 'connection').length,
      mapping: notifications.filter(n => n.category === 'mapping').length,
      system: notifications.filter(n => n.category === 'system').length,
      inventory: notifications.filter(n => n.category === 'inventory').length,
    },
    recent: notifications.slice(0, 10),
  };
}

// Hook para escuchar nuevas notificaciones
export function onNotificationAdded(callback: (notification: Notification) => void): () => void {
  const handler = (event: Event) => {
    const customEvent = event as CustomEvent;
    callback(customEvent.detail);
  };

  window.addEventListener('notification-added', handler);

  return () => {
    window.removeEventListener('notification-added', handler);
  };
}
