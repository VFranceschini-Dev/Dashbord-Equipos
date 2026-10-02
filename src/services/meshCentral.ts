export interface MeshConfig {
  serverUrl: string;
  username: string;
  password: string;
  autoSync: boolean;
  syncInterval: number; // minutos
}

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
}

export interface MeshGroup {
  id: string;
  name: string;
  description?: string;
  nodeCount: number;
  connectedCount: number;
}

class MeshCentralService {
  private config: MeshConfig | null = null;
  private ws: WebSocket | null = null;
  private connected: boolean = false;
  private nodes: MeshNode[] = [];
  private groups: MeshGroup[] = [];
  private listeners: ((event: string, data: any) => void)[] = [];
  private syncTimer: any = null;

  // Configuración
  setConfig(config: MeshConfig) {
    this.config = config;
    localStorage.setItem('mesh_config', JSON.stringify(config));
  }

  getConfig(): MeshConfig | null {
    if (this.config) return this.config;
    const saved = localStorage.getItem('mesh_config');
    if (saved) {
      this.config = JSON.parse(saved);
      return this.config;
    }
    return null;
  }

  clearConfig() {
    this.config = null;
    localStorage.removeItem('mesh_config');
    this.disconnect();
  }

  // Conexión WebSocket
  async connect(): Promise<boolean> {
    const config = this.getConfig();
    if (!config) {
      console.warn('MeshCentral: No hay configuración');
      return false;
    }

    return new Promise((resolve) => {
      try {
        const wsUrl = config.serverUrl.replace('https://', 'wss://').replace('http://', 'ws://');
        this.ws = new WebSocket(`${wsUrl}/meshrelay.ashx`);

        this.ws.onopen = () => {
          console.log('MeshCentral: Conectado');
          this.connected = true;
          this.ws?.send(JSON.stringify({
            action: 'auth',
            username: config.username,
            password: config.password,
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
          console.log('MeshCentral: Desconectado');
          this.connected = false;
          this.notifyListeners('disconnected', null);
        };

        setTimeout(() => {
          if (!this.connected) resolve(false);
        }, 5000);
      } catch (error) {
        console.error('MeshCentral: Error al conectar', error);
        resolve(false);
      }
    });
  }

  private handleMessage(data: any) {
    switch (data.action) {
      case 'authComplete':
        console.log('MeshCentral: Autenticación exitosa');
        this.requestNodes();
        this.requestGroups();
        this.notifyListeners('connected', null);
        break;
      
      case 'nodes':
        this.nodes = this.parseNodes(data.nodes || []);
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
    }
  }

  private parseNodes(rawNodes: any[]): MeshNode[] {
    return rawNodes.map((node: any) => ({
      id: node._id || node.id,
      name: node.name || 'Unknown',
      hostname: node.hostname || node.rname || '',
      ip: node.ip || node.host || '',
      os: node.os || node.osdesc || '',
      status: (node.conn === 1 || node.connected) ? 'connected' : 'disconnected',
      lastSeen: node.lastConnectTime 
        ? new Date(node.lastConnectTime * 1000).toISOString() 
        : new Date().toISOString(),
      group: node.meshName || node.groupName || '',
      agentVersion: node.agentVersion || '',
      cpu: node.cpu || '',
      ram: node.ram ? `${Math.round(node.ram / 1024)}MB` : '',
    }));
  }

  private updateNode(nodeData: any) {
    const index = this.nodes.findIndex(n => n.id === nodeData._id);
    if (index >= 0) {
      this.nodes[index] = { ...this.nodes[index], ...this.parseNodes([nodeData])[0] };
      this.notifyListeners('nodesUpdated', this.nodes);
    }
  }

  private updateNodeStatus(nodeId: string, connected: boolean) {
    const node = this.nodes.find(n => n.id === nodeId);
    if (node) {
      node.status = connected ? 'connected' : 'disconnected';
      node.lastSeen = new Date().toISOString();
      this.notifyListeners('nodesUpdated', this.nodes);
    }
  }

  private requestNodes() {
    if (this.ws && this.connected) {
      this.ws.send(JSON.stringify({ action: 'nodes' }));
    }
  }

  private requestGroups() {
    if (this.ws && this.connected) {
      this.ws.send(JSON.stringify({ action: 'meshes' }));
    }
  }

  // Sincronización automática
  startAutoSync(intervalMinutes: number) {
    if (this.syncTimer) clearInterval(this.syncTimer);
    this.syncTimer = setInterval(() => {
      this.requestNodes();
      this.requestGroups();
    }, intervalMinutes * 60 * 1000);
  }

  stopAutoSync() {
    if (this.syncTimer) {
      clearInterval(this.syncTimer);
      this.syncTimer = null;
    }
  }

  // Métodos públicos
  async getNodes(): Promise<MeshNode[]> {
    if (!this.connected) {
      const connected = await this.connect();
      if (!connected) return [];
    }
    return this.nodes;
  }

  async getGroups(): Promise<MeshGroup[]> {
    if (!this.connected) await this.connect();
    return this.groups;
  }

  isConnected(): boolean {
    return this.connected;
  }

  disconnect() {
    this.stopAutoSync();
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.connected = false;
  }

  // Listeners
  addListener(callback: (event: string, data: any) => void) {
    this.listeners.push(callback);
    return () => {
      this.listeners = this.listeners.filter(l => l !== callback);
    };
  }

  private notifyListeners(event: string, data: any) {
    this.listeners.forEach(listener => listener(event, data));
  }

  // Importar nodos a la base de datos local
  async importNodesToLocal(): Promise<MeshNode[]> {
    const nodes = await this.getNodes();
    return nodes;
  }
}

export const meshCentralService = new MeshCentralService();
