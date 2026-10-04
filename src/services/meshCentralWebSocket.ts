import { ExternalServer, SyncedDevice } from '../types';

export interface WebSocketMessage {
  action: string;
  data?: any;
}

export interface MeshCentralNode {
  _id: string;
  name: string;
  hostname?: string;
  ip?: string;
  os?: string;
  conn?: number;
  connected?: boolean;
  lastConnectTime?: number;
  meshName?: string;
  groupName?: string;
  agentVersion?: string;
  cpu?: string;
  ram?: number;
}

class MeshCentralWebSocketService {
  private ws: WebSocket | null = null;
  private reconnectTimer: any = null;
  private messageHandlers: ((message: WebSocketMessage) => void)[] = [];
  private connectionStatus: 'disconnected' | 'connecting' | 'connected' | 'error' = 'disconnected';
  private statusListeners: ((status: string) => void)[] = [];

  // Conectar al servidor MeshCentral
  async connect(server: ExternalServer): Promise<boolean> {
    return new Promise((resolve) => {
      try {
        this.connectionStatus = 'connecting';
        this.notifyStatusChange();

        // Convertir URL HTTP a WebSocket
        const wsUrl = server.url
          .replace('https://', 'wss://')
          .replace('http://', 'ws://');

        this.ws = new WebSocket(`${wsUrl}/meshrelay.ashx`);

        this.ws.onopen = () => {
          console.log('MeshCentral WebSocket: Conectado');
          this.connectionStatus = 'connected';
          this.notifyStatusChange();

          // Enviar autenticación
          this.ws?.send(JSON.stringify({
            action: 'auth',
            username: server.username,
            password: server.password,
          }));

          resolve(true);
        };

        this.ws.onmessage = (event) => {
          try {
            const message = JSON.parse(event.data);
            this.handleMessage(message);
          } catch (error) {
            console.error('MeshCentral WebSocket: Error parseando mensaje', error);
          }
        };

        this.ws.onerror = (error) => {
          console.error('MeshCentral WebSocket: Error', error);
          this.connectionStatus = 'error';
          this.notifyStatusChange();
          resolve(false);
        };

        this.ws.onclose = () => {
          console.log('MeshCentral WebSocket: Desconectado');
          this.connectionStatus = 'disconnected';
          this.notifyStatusChange();
          this.scheduleReconnect(server);
        };

        // Timeout de conexión
        setTimeout(() => {
          if (this.connectionStatus === 'connecting') {
            this.connectionStatus = 'error';
            this.notifyStatusChange();
            resolve(false);
          }
        }, 10000);

      } catch (error) {
        console.error('MeshCentral WebSocket: Error al conectar', error);
        this.connectionStatus = 'error';
        this.notifyStatusChange();
        resolve(false);
      }
    });
  }

  // Manejar mensajes del servidor
  private handleMessage(message: WebSocketMessage) {
    switch (message.action) {
      case 'authComplete':
        console.log('MeshCentral WebSocket: Autenticación exitosa');
        this.requestNodes();
        break;

      case 'nodes':
        console.log('MeshCentral WebSocket: Nodos recibidos', message.data);
        break;

      case 'nodeChange':
        console.log('MeshCentral WebSocket: Cambio de nodo', message.data);
        break;

      case 'authError':
        console.error('MeshCentral WebSocket: Error de autenticación');
        this.connectionStatus = 'error';
        this.notifyStatusChange();
        break;

      default:
        console.log('MeshCentral WebSocket: Mensaje recibido', message);
    }

    // Notificar a todos los handlers
    this.messageHandlers.forEach(handler => handler(message));
  }

  // Solicitar lista de nodos
  private requestNodes() {
    if (this.ws && this.connectionStatus === 'connected') {
      this.ws.send(JSON.stringify({ action: 'nodes' }));
    }
  }

  // Programar reconexión
  private scheduleReconnect(server: ExternalServer) {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
    }

    this.reconnectTimer = setTimeout(() => {
      console.log('MeshCentral WebSocket: Intentando reconectar...');
      this.connect(server);
    }, 5000);
  }

  // Desconectar
  disconnect() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }

    this.connectionStatus = 'disconnected';
    this.notifyStatusChange();
  }

  // Obtener estado de conexión
  getConnectionStatus(): string {
    return this.connectionStatus;
  }

  // Agregar handler de mensajes
  addMessageHandler(handler: (message: WebSocketMessage) => void) {
    this.messageHandlers.push(handler);
    return () => {
      this.messageHandlers = this.messageHandlers.filter(h => h !== handler);
    };
  }

  // Agregar listener de estado
  addStatusListener(listener: (status: string) => void) {
    this.statusListeners.push(listener);
    return () => {
      this.statusListeners = this.statusListeners.filter(l => l !== listener);
    };
  }

  // Notificar cambio de estado
  private notifyStatusChange() {
    this.statusListeners.forEach(listener => listener(this.connectionStatus));
  }

  // Convertir nodos de MeshCentral a SyncedDevice
  convertNodesToSyncedDevices(nodes: MeshCentralNode[], serverId: string): SyncedDevice[] {
    return nodes.map(node => ({
      id: `synced-${node._id}`,
      serverId,
      externalId: node._id,
      name: node.name || 'Unknown',
      hostname: node.hostname || '',
      ip: node.ip || '',
      os: node.os || '',
      status: (node.conn === 1 || node.connected) ? 'connected' : 'disconnected',
      lastSeen: node.lastConnectTime
        ? new Date(node.lastConnectTime * 1000).toISOString()
        : new Date().toISOString(),
      group: node.meshName || node.groupName || '',
      cpu: node.cpu || '',
      ram: node.ram ? `${Math.round(node.ram / 1024)}MB` : '',
      syncedAt: new Date().toISOString(),
    }));
  }
}

// Exportar instancia singleton
export const meshCentralWebSocket = new MeshCentralWebSocketService();
