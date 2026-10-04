import { ExternalServer, SyncedDevice } from '../types';
import { meshCentralWebSocket } from './meshCentralWebSocket';

// Interfaz base para todos los servicios de servidor
export interface ServerService {
  type: string;
  connect(server: ExternalServer): Promise<boolean>;
  disconnect(): void;
  getDevices(server: ExternalServer): Promise<SyncedDevice[]>;
  testConnection(server: ExternalServer): Promise<{ success: boolean; message: string; latency?: number }>;
  getStatus(): string;
}

// Servicio para MeshCentral
class MeshCentralService implements ServerService {
  type = 'meshcentral';

  async connect(server: ExternalServer): Promise<boolean> {
    return meshCentralWebSocket.connect(server);
  }

  disconnect(): void {
    meshCentralWebSocket.disconnect();
  }

  async getDevices(server: ExternalServer): Promise<SyncedDevice[]> {
    // En producción, esto obtendría los dispositivos reales del servidor
    // Por ahora, retornamos un array vacío
    // La implementación real usaría WebSocket para obtener los nodos
    return [];
  }

  async testConnection(server: ExternalServer): Promise<{ success: boolean; message: string; latency?: number }> {
    const startTime = Date.now();
    
    try {
      const connected = await this.connect(server);
      const latency = Date.now() - startTime;

      if (connected) {
        this.disconnect();
        return {
          success: true,
          message: 'Conexión exitosa',
          latency,
        };
      } else {
        return {
          success: false,
          message: 'No se pudo establecer conexión',
          latency,
        };
      }
    } catch (error) {
      return {
        success: false,
        message: `Error: ${error}`,
        latency: Date.now() - startTime,
      };
    }
  }

  getStatus(): string {
    return meshCentralWebSocket.getConnectionStatus();
  }
}

// Servicio para servidores personalizados (API REST)
class CustomRestService implements ServerService {
  type = 'custom';

  async connect(server: ExternalServer): Promise<boolean> {
    try {
      const response = await fetch(`${server.url}/api/health`, {
        method: 'GET',
        headers: {
          'Authorization': `Basic ${btoa(`${server.username}:${server.password}`)}`,
          'Content-Type': 'application/json',
        },
      });

      return response.ok;
    } catch (error) {
      console.error('Custom REST: Error al conectar', error);
      return false;
    }
  }

  disconnect(): void {
    // No hay conexión persistente para REST
  }

  async getDevices(server: ExternalServer): Promise<SyncedDevice[]> {
    try {
      const response = await fetch(`${server.url}/api/devices`, {
        method: 'GET',
        headers: {
          'Authorization': `Basic ${btoa(`${server.username}:${server.password}`)}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error('Error al obtener dispositivos');
      }

      const data = await response.json();
      
      // Mapear respuesta del servidor a SyncedDevice
      return data.map((device: any) => ({
        id: `synced-${device.id}`,
        serverId: server.id,
        externalId: device.id,
        name: device.name || 'Unknown',
        hostname: device.hostname || '',
        ip: device.ip || '',
        os: device.os || '',
        status: device.status || 'disconnected',
        lastSeen: device.lastSeen || new Date().toISOString(),
        group: device.group || '',
        cpu: device.cpu || '',
        ram: device.ram || '',
        syncedAt: new Date().toISOString(),
      }));
    } catch (error) {
      console.error('Custom REST: Error al obtener dispositivos', error);
      return [];
    }
  }

  async testConnection(server: ExternalServer): Promise<{ success: boolean; message: string; latency?: number }> {
    const startTime = Date.now();
    
    try {
      const connected = await this.connect(server);
      const latency = Date.now() - startTime;

      return {
        success: connected,
        message: connected ? 'Conexión exitosa' : 'No se pudo conectar',
        latency,
      };
    } catch (error) {
      return {
        success: false,
        message: `Error: ${error}`,
        latency: Date.now() - startTime,
      };
    }
  }

  getStatus(): string {
    return 'disconnected';
  }
}

// Servicio para servidores MQTT (IoT)
class MQTTService implements ServerService {
  type = 'mqtt';

  async connect(server: ExternalServer): Promise<boolean> {
    // Implementación MQTT futura
    console.log('MQTT: Conectando a', server.url);
    return false;
  }

  disconnect(): void {
    console.log('MQTT: Desconectando');
  }

  async getDevices(server: ExternalServer): Promise<SyncedDevice[]> {
    // Implementación MQTT futura
    return [];
  }

  async testConnection(server: ExternalServer): Promise<{ success: boolean; message: string; latency?: number }> {
    return {
      success: false,
      message: 'Servicio MQTT aún no implementado',
    };
  }

  getStatus(): string {
    return 'disconnected';
  }
}

// Registro de servicios de servidor
class ServerServiceRegistry {
  private services: Map<string, ServerService> = new Map();

  constructor() {
    // Registrar servicios por defecto
    this.register(new MeshCentralService());
    this.register(new CustomRestService());
    this.register(new MQTTService());
  }

  register(service: ServerService): void {
    this.services.set(service.type, service);
  }

  getService(type: string): ServerService | undefined {
    return this.services.get(type);
  }

  getAvailableTypes(): string[] {
    return Array.from(this.services.keys());
  }

  async testConnection(server: ExternalServer): Promise<{ success: boolean; message: string; latency?: number }> {
    const service = this.getService(server.type);
    
    if (!service) {
      return {
        success: false,
        message: `Tipo de servidor no soportado: ${server.type}`,
      };
    }

    return service.testConnection(server);
  }

  async getDevices(server: ExternalServer): Promise<SyncedDevice[]> {
    const service = this.getService(server.type);
    
    if (!service) {
      console.error(`Tipo de servidor no soportado: ${server.type}`);
      return [];
    }

    return service.getDevices(server);
  }

  async connect(server: ExternalServer): Promise<boolean> {
    const service = this.getService(server.type);
    
    if (!service) {
      console.error(`Tipo de servidor no soportado: ${server.type}`);
      return false;
    }

    return service.connect(server);
  }

  disconnect(serverType: string): void {
    const service = this.getService(serverType);
    
    if (service) {
      service.disconnect();
    }
  }

  getStatus(serverType: string): string {
    const service = this.getService(serverType);
    return service ? service.getStatus() : 'unknown';
  }
}

// Exportar instancia singleton del registro
export const serverServiceRegistry = new ServerServiceRegistry();

// Función helper para probar conexión
export async function testServerConnection(server: ExternalServer): Promise<{
  success: boolean;
  message: string;
  latency?: number;
  serverType: string;
}> {
  const result = await serverServiceRegistry.testConnection(server);
  
  return {
    ...result,
    serverType: server.type,
  };
}

// Función helper para obtener dispositivos
export async function getServerDevices(server: ExternalServer): Promise<SyncedDevice[]> {
  return serverServiceRegistry.getDevices(server);
}

// Función helper para conectar
export async function connectToServer(server: ExternalServer): Promise<boolean> {
  return serverServiceRegistry.connect(server);
}

// Función helper para desconectar
export function disconnectFromServer(serverType: string): void {
  serverServiceRegistry.disconnect(serverType);
}

// Función helper para obtener estado
export function getServerStatus(serverType: string): string {
  return serverServiceRegistry.getStatus(serverType);
}
