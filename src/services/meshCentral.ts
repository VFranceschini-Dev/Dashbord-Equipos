// Servicio de conexión a MeshCentral via WebSocket
// Documentación: https://docs.meshcentral.com/meshctrl/
// 
// IMPORTANTE: MeshCentral usa WebSocket, NO REST API
// Requiere configuración en el servidor MeshCentral:
//   config.json -> "settings": { "AllowLoginToken": true, "allowFraming": true }

const MESH_CENTRAL_URL = 'https://mesh.donnet.com.ar';
const MESH_WS_URL = 'wss://mesh.donnet.com.ar';

export interface MeshNode {
  id: string;
  name: string;
  hostname: string;
  ip: string;
  os: string;
  status: 'connected' | 'disconnected';
  lastSeen: string;
  group?: string;
  agentVersion?: string;
  cpu?: string;
  ram?: string;
  icon?: number;
  powerState?: number;
}

export interface MeshGroup {
  id: string;
  name: string;
  description?: string;
  nodeCount: number;
  connectedCount: number;
}

export interface MeshServerInfo {
  name: string;
  port: number;
  https: boolean;
  redirPort: number;
}

class MeshCentralService {
  private ws: WebSocket | null = null;
  private apiKey: string | null = null;
  private username: string | null = null;
  private password: string | null = null;
  private connected: boolean = false;
  private nodes: MeshNode[] = [];
  private groups: MeshGroup[] = [];
  private listeners: ((event: string, data: any) => void)[] = [];
  private reconnectTimer: any = null;
  private lastUpdate: Date = new Date();

  // Configurar credenciales
  setCredentials(username: string, password: string) {
    this.username = username;
    this.password = password;
    localStorage.setItem('mesh_username', username);
    localStorage.setItem('mesh_password', btoa(password)); // Base64 encoding básico
  }

  getCredentials(): { username: string; password: string } | null {
    const username = localStorage.getItem('mesh_username');
    const passwordB64 = localStorage.getItem('mesh_password');
    if (username && passwordB64) {
      return { username, password: atob(passwordB64) };
    }
    return null;
  }

  setApiKey(key: string) {
    this.apiKey = key;
    localStorage.setItem('mesh_api_key', key);
  }

  getApiKey(): string | null {
    return this.apiKey || localStorage.getItem('mesh_api_key');
  }

  // Conectar via WebSocket
  async connect(): Promise<boolean> {
    const creds = this.getCredentials();
    if (!creds) {
      console.warn('MeshCentral: No hay credenciales configuradas');
      return false;
    }

    return new Promise((resolve) => {
      try {
        this.ws = new WebSocket(`${MESH_WS_URL}/meshrelay.ashx`);

        this.ws.onopen = () => {
          console.log('MeshCentral: WebSocket conectado');
          this.connected = true;
          
          // Enviar autenticación
          this.ws?.send(JSON.stringify({
            action: 'auth',
            username: creds.username,
            password: creds.password
          }));

          resolve(true);
        };

        this.ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            this.handleMessage(data);
          } catch (e) {
            console.error('MeshCentral: Error parseando mensaje', e);
          }
        };

        this.ws.onerror = (error) => {
          console.error('MeshCentral: Error WebSocket', error);
          this.connected = false;
          resolve(false);
        };

        this.ws.onclose = () => {
          console.log('MeshCentral: WebSocket cerrado');
          this.connected = false;
          this.scheduleReconnect();
        };

        // Timeout de conexión
        setTimeout(() => {
          if (!this.connected) {
            resolve(false);
          }
        }, 5000);

      } catch (error) {
        console.error('MeshCentral: Error al conectar', error);
        resolve(false);
      }
    });
  }

  // Manejar mensajes del WebSocket
  private handleMessage(data: any) {
    switch (data.action) {
      case 'authComplete':
        console.log('MeshCentral: Autenticación exitosa');
        this.requestNodes();
        this.requestGroups();
        break;
      
      case 'nodes':
        this.nodes = this.parseNodes(data.nodes || []);
        this.lastUpdate = new Date();
        this.notifyListeners('nodesUpdated', this.nodes);
        break;
      
      case 'groups':
        this.groups = data.groups || [];
        this.notifyListeners('groupsUpdated', this.groups);
        break;
      
      case 'nodeChange':
        this.updateNode(data.node);
        break;
      
      case 'nodeConnectionChange':
        this.updateNodeStatus(data.nodeId, data.connected);
        break;

      default:
        this.notifyListeners(data.action, data);
    }
  }

  // Parsear nodos del formato MeshCentral
  private parseNodes(rawNodes: any[]): MeshNode[] {
    return rawNodes.map((node: any) => ({
      id: node._id || node.id,
      name: node.name || 'Unknown',
      hostname: node.hostname || node.rname || '',
      ip: node.ip || node.host || '',
      os: node.os || node.osdesc || '',
      status: (node.conn === 1 || node.connected) ? 'connected' : 'disconnected',
      lastSeen: node.lastConnectTime ? new Date(node.lastConnectTime * 1000).toISOString() : new Date().toISOString(),
      group: node.meshName || node.groupName || '',
      agentVersion: node.agentVersion || '',
      cpu: node.cpu || '',
      ram: node.ram ? `${Math.round(node.ram / 1024)}MB` : '',
      icon: node.icon,
      powerState: node.pwr,
    }));
  }

  // Actualizar un nodo específico
  private updateNode(nodeData: any) {
    const index = this.nodes.findIndex(n => n.id === nodeData._id);
    if (index >= 0) {
      this.nodes[index] = { ...this.nodes[index], ...this.parseNodes([nodeData])[0] };
      this.notifyListeners('nodesUpdated', this.nodes);
    }
  }

  // Actualizar estado de conexión de un nodo
  private updateNodeStatus(nodeId: string, connected: boolean) {
    const node = this.nodes.find(n => n.id === nodeId);
    if (node) {
      node.status = connected ? 'connected' : 'disconnected';
      node.lastSeen = new Date().toISOString();
      this.notifyListeners('nodesUpdated', this.nodes);
    }
  }

  // Solicitar lista de nodos
  private requestNodes() {
    if (this.ws && this.connected) {
      this.ws.send(JSON.stringify({ action: 'nodes' }));
    }
  }

  // Solicitar lista de grupos
  private requestGroups() {
    if (this.ws && this.connected) {
      this.ws.send(JSON.stringify({ action: 'meshes' }));
    }
  }

  // Programar reconexión
  private scheduleReconnect() {
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.reconnectTimer = setTimeout(() => {
      console.log('MeshCentral: Intentando reconectar...');
      this.connect();
    }, 30000);
  }

  // Agregar listener de eventos
  addListener(callback: (event: string, data: any) => void) {
    this.listeners.push(callback);
    return () => {
      this.listeners = this.listeners.filter(l => l !== callback);
    };
  }

  private notifyListeners(event: string, data: any) {
    this.listeners.forEach(listener => listener(event, data));
  }

  // ============================================
  // MÉTODOS PÚBLICOS - Para usar en componentes
  // ============================================

  // Obtener todos los nodos
  async getNodes(): Promise<MeshNode[]> {
    if (!this.connected) {
      const connected = await this.connect();
      if (!connected) {
        // Si no se puede conectar, retornar array vacío
        // En producción, aquí se podría usar un backend proxy
        return [];
      }
    }
    return this.nodes;
  }

  // Obtener todos los grupos
  async getGroups(): Promise<MeshGroup[]> {
    if (!this.connected) await this.connect();
    return this.groups;
  }

  // Obtener información del servidor
  async getServerInfo(): Promise<MeshServerInfo | null> {
    try {
      const response = await fetch(`${MESH_CENTRAL_URL}/meshcentral.ashx/info`);
      if (response.ok) {
        return await response.json();
      }
    } catch (error) {
      console.error('Error obteniendo info del servidor:', error);
    }
    return null;
  }

  // Obtener detalles de un nodo específico
  async getNodeDetails(nodeId: string): Promise<MeshNode | null> {
    return this.nodes.find(n => n.id === nodeId) || null;
  }

  // Obtener nodos conectados
  async getConnectedNodes(): Promise<MeshNode[]> {
    const nodes = await this.getNodes();
    return nodes.filter(n => n.status === 'connected');
  }

  // Obtener nodos desconectados
  async getDisconnectedNodes(): Promise<MeshNode[]> {
    const nodes = await this.getNodes();
    return nodes.filter(n => n.status === 'disconnected');
  }

  // Obtener estadísticas
  async getStats(): Promise<{
    total: number;
    connected: number;
    disconnected: number;
    groups: number;
  }> {
    const nodes = await this.getNodes();
    const groups = await this.getGroups();
    return {
      total: nodes.length,
      connected: nodes.filter(n => n.status === 'connected').length,
      disconnected: nodes.filter(n => n.status === 'disconnected').length,
      groups: groups.length,
    };
  }

  // Verificar si está conectado
  isConnected(): boolean {
    return this.connected;
  }

  // Desconectar
  disconnect() {
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.connected = false;
  }

  // Obtener URL de MeshCentral
  getMeshCentralUrl(): string {
    return MESH_CENTRAL_URL;
  }

  // Obtener URL para embeber un nodo específico (remote desktop)
  getNodeEmbedUrl(nodeId: string, viewMode: number = 11): string {
    const creds = this.getCredentials();
    if (!creds) return MESH_CENTRAL_URL;
    
    // viewMode: 11 = Remote Desktop, 12 = Terminal, 13 = Files
    // hide: 15 = Ocultar header y tabs
    return `${MESH_CENTRAL_URL}?login=${creds.username}:${creds.password}&node=${nodeId}&viewmode=${viewMode}&hide=15`;
  }

  // Última actualización
  getLastUpdate(): Date {
    return this.lastUpdate;
  }
}

// Exportar instancia singleton
export const meshCentralService = new MeshCentralService();
