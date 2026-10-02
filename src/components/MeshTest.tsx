import { useState, useRef, useEffect } from 'react';
import { 
  Server, Wifi, WifiOff, RefreshCw, AlertCircle, CheckCircle, 
  Monitor, Search, Trash2, Play, Square, Database, Network
} from 'lucide-react';

interface MeshNode {
  id: string;
  name: string;
  hostname?: string;
  rname?: string;
  ip?: string;
  host?: string;
  os?: string;
  osdesc?: string;
  conn?: number;
  connected?: boolean;
  meshName?: string;
  groupName?: string;
  agentVersion?: string;
  cpu?: string;
  ram?: number;
}

interface LogEntry {
  timestamp: string;
  message: string;
  type: 'info' | 'success' | 'error' | 'warning';
}

export default function MeshTest() {
  const [serverUrl, setServerUrl] = useState('https://mesh.donnet.com.ar');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [pcSearch, setPcSearch] = useState('');
  const [connecting, setConnecting] = useState(false);
  const [connected, setConnected] = useState(false);
  const [nodes, setNodes] = useState<MeshNode[]>([]);
  const [foundPC, setFoundPC] = useState<MeshNode | null>(null);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [status, setStatus] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
  
  const wsRef = useRef<WebSocket | null>(null);
  const logEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  const addLog = (message: string, type: LogEntry['type'] = 'info') => {
    const timestamp = new Date().toLocaleTimeString('es-AR');
    setLogs(prev => [...prev, { timestamp, message, type }]);
  };

  const clearLogs = () => {
    setLogs([]);
  };

  const showStatus = (message: string, type: 'success' | 'error' | 'info') => {
    setStatus({ message, type });
  };

  const testConnection = async () => {
    if (!serverUrl || !username || !password) {
      showStatus('❌ Por favor completa todos los campos obligatorios', 'error');
      addLog('Error: Campos incompletos', 'error');
      return;
    }

    setConnecting(true);
    setConnected(false);
    setNodes([]);
    setFoundPC(null);
    
    addLog('Iniciando prueba de conexión...', 'info');
    addLog(`Servidor: ${serverUrl}`, 'info');
    addLog(`Usuario: ${username}`, 'info');

    try {
      // Convertir URL HTTPS a WSS
      const wsUrl = serverUrl.replace('https://', 'wss://').replace('http://', 'ws://');
      addLog(`WebSocket URL: ${wsUrl}/meshrelay.ashx`, 'info');
      
      // Crear conexión WebSocket
      const ws = new WebSocket(`${wsUrl}/meshrelay.ashx`);
      wsRef.current = ws;
      
      ws.onopen = () => {
        addLog('✅ WebSocket conectado', 'success');
        showStatus('✅ Conectado al servidor. Autenticando...', 'success');
        
        // Enviar credenciales
        const authMessage = {
          action: 'auth',
          username: username,
          password: password
        };
        
        ws.send(JSON.stringify(authMessage));
        addLog('Credenciales enviadas', 'info');
      };
      
      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          handleMessage(data);
        } catch (e) {
          addLog(`Error al parsear mensaje: ${e}`, 'error');
        }
      };
      
      ws.onerror = () => {
        addLog('❌ Error en la conexión WebSocket', 'error');
        showStatus('❌ Error de conexión. Verifica la URL del servidor y que el servidor permita conexiones WebSocket.', 'error');
        setConnecting(false);
      };
      
      ws.onclose = () => {
        addLog('🔌 Conexión cerrada', 'warning');
        setConnecting(false);
        setConnected(false);
      };
      
      // Timeout después de 10 segundos
      setTimeout(() => {
        if (ws && ws.readyState === WebSocket.CONNECTING) {
          addLog('⏱️ Timeout: La conexión tardó demasiado', 'warning');
          showStatus('⏱️ Timeout: No se pudo conectar en 10 segundos', 'error');
          ws.close();
          setConnecting(false);
        }
      }, 10000);
      
    } catch (error) {
      addLog(`❌ Error: ${error}`, 'error');
      showStatus(`❌ Error: ${error}`, 'error');
      setConnecting(false);
    }
  };

  const handleMessage = (data: any) => {
    addLog(`Mensaje recibido: ${data.action}`, 'info');
    
    switch (data.action) {
      case 'authComplete':
        addLog('✅ Autenticación exitosa', 'success');
        showStatus('✅ Autenticación exitosa. Solicitando lista de PCs...', 'success');
        setConnected(true);
        
        // Solicitar lista de nodos
        wsRef.current?.send(JSON.stringify({ action: 'nodes' }));
        addLog('Solicitando lista de nodos...', 'info');
        break;
      
      case 'nodes':
        addLog(`📋 Recibidos ${data.nodes.length} nodos`, 'success');
        setNodes(data.nodes);
        displayNodes(data.nodes);
        break;
      
      case 'authError':
        addLog('❌ Error de autenticación', 'error');
        showStatus('❌ Error de autenticación. Verifica usuario y contraseña.', 'error');
        break;
      
      default:
        addLog(`Mensaje no reconocido: ${data.action}`, 'warning');
    }
  };

  const displayNodes = (nodes: MeshNode[]) => {
    const connected = nodes.filter(n => n.conn === 1 || n.connected);
    const disconnected = nodes.filter(n => n.conn !== 1 && !n.connected);
    
    showStatus(
      `✅ Conexión exitosa. Se encontraron ${nodes.length} PCs (${connected.length} conectadas, ${disconnected.length} desconectadas)`, 
      'success'
    );
    
    // Buscar PC específica
    if (pcSearch) {
      addLog(`🔍 Buscando PC: "${pcSearch}"`, 'info');
      const found = nodes.find(n => 
        n.name.toLowerCase().includes(pcSearch.toLowerCase()) ||
        (n.hostname && n.hostname.toLowerCase().includes(pcSearch.toLowerCase())) ||
        (n.rname && n.rname.toLowerCase().includes(pcSearch.toLowerCase()))
      );
      
      if (found) {
        addLog(`✅ PC encontrada: ${found.name}`, 'success');
        setFoundPC(found);
      } else {
        addLog(`❌ PC no encontrada: "${pcSearch}"`, 'error');
        setFoundPC(null);
      }
    }
    
    setConnecting(false);
  };

  const disconnect = () => {
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    setConnected(false);
    setNodes([]);
    setFoundPC(null);
    addLog('Desconectado manualmente', 'warning');
  };

  const connectedCount = nodes.filter(n => n.conn === 1 || n.connected).length;
  const disconnectedCount = nodes.filter(n => n.conn !== 1 && !n.connected).length;

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-2xl p-6 text-white">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-white/10 rounded-xl">
            <Network size={32} />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Test de Conexión MeshCentral</h1>
            <p className="text-sm text-blue-100">Script para probar la conexión con tu servidor MeshCentral</p>
          </div>
        </div>
      </div>

      {/* Configuration Form */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 border border-gray-200 dark:border-gray-700">
        <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-4 flex items-center gap-2">
          <Server size={20} />
          Configuración de Conexión
        </h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              URL del Servidor MeshCentral:
            </label>
            <input
              type="text"
              value={serverUrl}
              onChange={(e) => setServerUrl(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-gray-100"
              placeholder="https://mesh.donnet.com.ar"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Usuario:
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-gray-100"
              placeholder="admin"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Contraseña:
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-gray-100"
              placeholder="••••••••"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Nombre de PC a buscar (opcional):
            </label>
            <input
              type="text"
              value={pcSearch}
              onChange={(e) => setPcSearch(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-gray-100"
              placeholder="Ej: PC-CONTABILIDAD-01"
            />
          </div>
        </div>
        
        <div className="flex gap-3 mt-6">
          {!connected ? (
            <button
              onClick={testConnection}
              disabled={connecting}
              className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg hover:from-blue-700 hover:to-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              {connecting ? (
                <>
                  <RefreshCw size={18} className="animate-spin" />
                  Conectando...
                </>
              ) : (
                <>
                  <Play size={18} />
                  Probar Conexión
                </>
              )}
            </button>
          ) : (
            <button
              onClick={disconnect}
              className="flex items-center gap-2 px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-all"
            >
              <Square size={18} />
              Desconectar
            </button>
          )}
          
          <button
            onClick={clearLogs}
            className="flex items-center gap-2 px-6 py-3 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-all"
          >
            <Trash2 size={18} />
            Limpiar Log
          </button>
        </div>
      </div>

      {/* Status */}
      {status && (
        <div className={`p-4 rounded-xl border-2 ${
          status.type === 'success' ? 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800' :
          status.type === 'error' ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800' :
          'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800'
        }`}>
          <div className="flex items-center gap-2">
            {status.type === 'success' ? <CheckCircle size={20} className="text-emerald-600 dark:text-emerald-400" /> :
             status.type === 'error' ? <AlertCircle size={20} className="text-red-600 dark:text-red-400" /> :
             <AlertCircle size={20} className="text-blue-600 dark:text-blue-400" />}
            <p className={`font-medium ${
              status.type === 'success' ? 'text-emerald-700 dark:text-emerald-300' :
              status.type === 'error' ? 'text-red-700 dark:text-red-300' :
              'text-blue-700 dark:text-blue-300'
            }`}>
              {status.message}
            </p>
          </div>
        </div>
      )}

      {/* Stats */}
      {nodes.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl p-6 text-white">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-blue-100">Total PCs</p>
                <p className="text-3xl font-bold mt-1">{nodes.length}</p>
              </div>
              <Database size={32} className="text-blue-200" />
            </div>
          </div>
          
          <div className="bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-xl p-6 text-white">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-emerald-100">Conectadas</p>
                <p className="text-3xl font-bold mt-1">{connectedCount}</p>
              </div>
              <Wifi size={32} className="text-emerald-200" />
            </div>
          </div>
          
          <div className="bg-gradient-to-br from-red-500 to-red-600 rounded-xl p-6 text-white">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-red-100">Desconectadas</p>
                <p className="text-3xl font-bold mt-1">{disconnectedCount}</p>
              </div>
              <WifiOff size={32} className="text-red-200" />
            </div>
          </div>
        </div>
      )}

      {/* Search Result */}
      {foundPC && (
        <div className="bg-amber-50 dark:bg-amber-900/20 border-2 border-amber-200 dark:border-amber-800 rounded-xl p-6">
          <h3 className="text-lg font-bold text-amber-900 dark:text-amber-100 mb-3 flex items-center gap-2">
            <CheckCircle size={20} />
            PC Encontrada
          </h3>
          <div className="space-y-2">
            <p className="text-lg font-semibold text-gray-900 dark:text-gray-100">{foundPC.name}</p>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <span className="font-medium text-gray-600 dark:text-gray-400">Hostname:</span>
                <span className="ml-2 text-gray-900 dark:text-gray-100">{foundPC.hostname || foundPC.rname || 'N/A'}</span>
              </div>
              <div>
                <span className="font-medium text-gray-600 dark:text-gray-400">IP:</span>
                <span className="ml-2 text-gray-900 dark:text-gray-100">{foundPC.ip || foundPC.host || 'N/A'}</span>
              </div>
              <div>
                <span className="font-medium text-gray-600 dark:text-gray-400">SO:</span>
                <span className="ml-2 text-gray-900 dark:text-gray-100">{foundPC.os || foundPC.osdesc || 'N/A'}</span>
              </div>
              <div>
                <span className="font-medium text-gray-600 dark:text-gray-400">Estado:</span>
                <span className="ml-2 text-gray-900 dark:text-gray-100">
                  {foundPC.conn === 1 || foundPC.connected ? '🟢 Conectada' : '🔴 Desconectada'}
                </span>
              </div>
              <div>
                <span className="font-medium text-gray-600 dark:text-gray-400">Grupo:</span>
                <span className="ml-2 text-gray-900 dark:text-gray-100">{foundPC.meshName || foundPC.groupName || 'Sin grupo'}</span>
              </div>
              {foundPC.agentVersion && (
                <div>
                  <span className="font-medium text-gray-600 dark:text-gray-400">Versión Agente:</span>
                  <span className="ml-2 text-gray-900 dark:text-gray-100">{foundPC.agentVersion}</span>
                </div>
              )}
              {foundPC.cpu && (
                <div>
                  <span className="font-medium text-gray-600 dark:text-gray-400">CPU:</span>
                  <span className="ml-2 text-gray-900 dark:text-gray-100">{foundPC.cpu}</span>
                </div>
              )}
              {foundPC.ram && (
                <div>
                  <span className="font-medium text-gray-600 dark:text-gray-400">RAM:</span>
                  <span className="ml-2 text-gray-900 dark:text-gray-100">{Math.round(foundPC.ram / 1024)}MB</span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* PC List */}
      {nodes.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 border border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-4 flex items-center gap-2">
            <Monitor size={20} />
            Lista de PCs ({nodes.length})
          </h3>
          <div className="space-y-3 max-h-96 overflow-y-auto">
            {nodes.map((node, index) => {
              const isConnected = node.conn === 1 || node.connected;
              return (
                <div
                  key={node.id || index}
                  className={`p-4 rounded-lg border-l-4 ${
                    isConnected 
                      ? 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-500' 
                      : 'bg-red-50 dark:bg-red-900/20 border-red-500'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <p className="font-semibold text-gray-900 dark:text-gray-100">{node.name}</p>
                      <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                        <strong>Hostname:</strong> {node.hostname || node.rname || 'N/A'} | 
                        <strong> IP:</strong> {node.ip || node.host || 'N/A'} | 
                        <strong> SO:</strong> {node.os || node.osdesc || 'N/A'}
                      </p>
                    </div>
                    <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                      isConnected 
                        ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400' 
                        : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400'
                    }`}>
                      {isConnected ? '🟢 Conectada' : '🔴 Desconectada'}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Log */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 border border-gray-200 dark:border-gray-700">
        <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-4 flex items-center gap-2">
          <RefreshCw size={20} />
          Log de Operaciones
        </h3>
        <div className="bg-gray-900 dark:bg-black rounded-lg p-4 font-mono text-sm max-h-80 overflow-y-auto">
          {logs.length === 0 ? (
            <p className="text-gray-500">No hay operaciones registradas</p>
          ) : (
            logs.map((log, index) => (
              <div
                key={index}
                className={`mb-1 ${
                  log.type === 'success' ? 'text-emerald-400' :
                  log.type === 'error' ? 'text-red-400' :
                  log.type === 'warning' ? 'text-amber-400' :
                  'text-blue-400'
                }`}
              >
                <span className="text-gray-500">[{log.timestamp}]</span> {log.message}
              </div>
            ))
          )}
          <div ref={logEndRef} />
        </div>
      </div>
    </div>
  );
}
