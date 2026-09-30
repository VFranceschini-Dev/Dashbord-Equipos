// Servicio para conectar con Mesh Central
// Documentación: https://github.com/Ylianst/MeshCentral

const MESH_CENTRAL_URL = 'https://mesh.donnet.com.ar';

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
  nodeCount: number;
  connectedCount: number;
}

class MeshCentralService {
  private apiKey: string | null = null;

  setApiKey(key: string) {
    this.apiKey = key;
    localStorage.setItem('mesh_api_key', key);
  }

  getApiKey(): string | null {
    return this.apiKey || localStorage.getItem('mesh_api_key');
  }

  async getNodes(): Promise<MeshNode[]> {
    // TODO: Implementar conexión real con Mesh Central API
    // Por ahora retorna array vacío - los datos vendrán de mesh.donnet.com.ar
    console.log('Conectando con Mesh Central:', MESH_CENTRAL_URL);
    return [];
  }

  async getGroups(): Promise<MeshGroup[]> {
    // TODO: Implementar conexión real con Mesh Central API
    return [];
  }

  async getNodeDetails(nodeId: string): Promise<MeshNode | null> {
    // TODO: Implementar conexión real
    return null;
  }

  getMeshCentralUrl(): string {
    return MESH_CENTRAL_URL;
  }
}

export const meshCentralService = new MeshCentralService();
