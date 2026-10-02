import { useState, useRef, useEffect } from 'react';
import { meshCentralService, MeshNode } from '../services/meshCentral';
import {
  Server, Wifi, WifiOff, RefreshCw, Search, CheckCircle, AlertCircle,
  Monitor, Cpu, HardDrive, Play, Square, Trash2, Download
} from 'lucide-react';

interface LogEntry {
  timestamp: string;
  message: string;
  type: 'info' | 'success' | 'error' | 'warning';
}

export default function MeshTestConnection() {
  const [serverUrl, setServerUrl] = useState('https://mesh.donnet.com.ar');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [pcSearch, setPcSearch] = useState('');
  const [connecting, setConnecting] = useState(false);
  const [connected, setConnected] = useState(false);
  const [nodes, setNodes] = useState<MeshNode[]>([]);
  const [foundPC, setFoundPC] = useState<MeshNode | null>(null);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [statusMessage, setStatusMessage] = useState<{ text: string; type: 'success' | 'error' | 'info' } | null>(null);
  const logRef = useRef<HTMLDivElement>(null);
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [logs]);

  const addLog = (message: string, type: LogEntry['type'] = 'info') => {
    const timestamp = new Date().toLocaleTimeString('es-AR');
    setLogs(prev => [...prev, { timestamp, message, type }]);
  };

  const clearLogs = () => {
    setLogs([]);
  };

  const testConnection = async () => {
    if (!serverUrl || !username || !password) {
      setStatusMessage({ text: '❌ Por favor completa todos los campos obligatorios', type: 'error' });
      addLog('Error: Campos incompletos', 'error');
      return;
    }

    setConnecting(true);
    setConnected(false);
    setNodes([]);
    setFoundPC(null);
    setStatusMessage(null);

    addLog('Iniciando prueba de conexión...', 'info');
    addLog(`Servidor: ${serverUrl}`, 'info');
    addLog(`Usuario: ${username}`, 'info');

    try {
      // Configurar el servicio
      meshCentralService.setConfig({
        serverUrl,
        username,
        password,
        autoSync: false,
        syncInterval: 5,
      });

      addLog(`Conectando a ${serverUrl}...`, 'info');
      setStatusMessage({ text: '⏳ Conectando al servidor...', type: 'info' });

      // Intentar conectar
      const success = await meshCentralService.connect();

      if (success) {
        addLog('✅ Conexión exitosa', 'success');
        setConnected(true);
        setStatusMessage({ text: '✅ Conectado exitosamente. Obteniendo lista de PCs...', type: 'success' });

        // Obtener nodos
        addLog('Solicitando lista de nodos...', 'info');
        const nodesList = await meshCentralService.getNodes();
        setNodes(nodesList);

        const connectedCount = nodesList.filter(n => n.status === 'connected').length;
        const disconnectedCount = nodesList.filter(n => n.status === 'disconnected').length;

        addLog(`📋 Recibidos ${nodesList.length} nodos`, 'success');
        addLog(`   - Conectados: ${connectedCount}`, 'success');
        addLog(`   - Desconectados: ${disconnectedCount}`, 'success');

        setStatusMessage({
          text: `✅ Conexión exitosa. Se encontraron ${nodesList.length} PCs (${connectedCount} conectadas, ${disconnectedCount} desconectadas)`,
          type: 'success'
        });

        // Buscar PC específica
        if (pcSearch) {
          searchPC(pcSearch, nodesList);
        }
      } else {
        addLog('❌ No se pudo conectar', 'error');
        setStatusMessage({
          text: '❌ Error de conexión. Verifica la URL del servidor y las credenciales.',
          type: 'error'
        });
      }
    } catch (error: any) {
      addLog(`❌ Error: ${error.message}`, 'error');
      setStatusMessage({ text: `❌ Error: ${error.message}`, type: 'error' });
    } finally {
      setConnecting(false);
    }
  };

  const searchPC = (searchTerm: string, nodesList: MeshNode[] = nodes) => {
    if (!searchTerm) {
      setFoundPC(null);
      return;
    }

    addLog(`🔍 Buscando PC: "${searchTerm}"`, 'info');

    const found = nodesList.find(n =>
      n.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (n.hostname && n.hostname.toLowerCase().includes(searchTerm.toLowerCase()))
    );

    if (found) {
      addLog(`✅ PC encontrada: ${found.name}`, 'success');
      setFoundPC(found);
    } else {
      addLog(`❌ PC no encontrada: "${searchTerm}"`, 'error');
      setFoundPC(null);
    }
  };

  const handleSearch = () => {
    if (nodes.length > 0 && pcSearch) {
      searchPC(pcSearch);
    }
  };

  const disconnect = () => {
    meshCentralService.disconnect();
    setConnected(false);
    setNodes([]);
    setFoundPC(null);
    addLog('🔌 Desconectado', 'warning');
    setStatusMessage({ text: '🔌 Desconectado del servidor', type: 'info' });
  };

  const exportResults = () => {
    const data = {
      fecha: new Date().toISOString(),
      servidor: serverUrl,
      totalPCs: nodes.length,
      pcs: nodes,
      pcBuscada: foundPC,
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `meshcentral-test-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(a.href);

    addLog('💾 Resultados exportados', 'success');
  };

  const connectedCount = nodes.filter(n => n.status === 'connected').length;
  const disconnectedCount = nodes.filter(n => n.status === 'disconnected').length;

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-2xl p-6 text-white">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-white/10 rounded-xl">
            <Server size={32} />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Test de Conexión MeshCentral</h1>
            <p className="text-sm text-blue-100">Prueba la conexión con tu servidor MeshCentral y busca PCs específicas</p>
          </div>
        </div>
      </div>

      {/* Connection Form */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
        <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-4">Configuración de Conexión</h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              URL del Servidor *
            </label>
            <input
              type="url"
              value={serverUrl}
              onChange={(e) => setServerUrl(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-gray-100"
              placeholder="https://mesh.donnet.com.ar"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Usuario *
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
              Contraseña *
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
              Buscar PC por Nombre (opcional)
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={pcSearch}
                onChange={(e) => setPcSearch(e.target.value)}
                className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-gray-100"
                placeholder="Ej: PC-CONTABILIDAD-01"
              />
              <button
                onClick={handleSearch}
                disabled={!connected || !pcSearch}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Search size={18} />
              </button>
            </div>
          </div>
        </div>

        <div className="flex gap-3">
          {!connected ? (
            <button
              onClick={testConnection}
              disabled={connecting}
              className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg hover:from-blue-700 hover:to-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed font-semibold"
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
              className="flex items-center gap-2 px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 font-semibold"
            >
              <Square size={18} />
              Desconectar
            </button>
          )}

          <button
            onClick={clearLogs}
            className="flex items-center gap-2 px-6 py-3 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 font-semibold"
          >
            <Trash2 size={18} />
            Limpiar Log
          </button>

          {nodes.length > 0 && (
            <button
              onClick={exportResults}
              className="flex items-center gap-2 px-6 py-3 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 font-semibold"
            >
              <Download size={18} />
              Exportar Resultados
            </button>
          )}
        </div>
      </div>

      {/* Status Message */}
      {statusMessage && (
        <div className={`p-4 rounded-xl border-2 ${
          statusMessage.type === 'success' ? 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800' :
          statusMessage.type === 'error' ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800' :
          'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800'
        }`}>
          <div className="flex items-center gap-3">
            {statusMessage.type === 'success' && <CheckCircle className="text-emerald-600 dark:text-emerald-400" size={20} />}
            {statusMessage.type === 'error' && <AlertCircle className="text-red-600 dark:text-red-400" size={20} />}
            {statusMessage.type === 'info' && <RefreshCw className="text-blue-600 dark:text-blue-400" size={20} />}
            <p className={`font-medium ${
              statusMessage.type === 'success' ? 'text-emerald-700 dark:text-emerald-300' :
              statusMessage.type === 'error' ? 'text-red-700 dark:text-red-300' :
              'text-blue-700 dark:text-blue-300'
            }`}>
              {statusMessage.text}
            </p>
          </div>
        </div>
      )}

      {/* Statistics */}
      {nodes.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl p-6 text-white">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-blue-100 text-sm font-medium">Total PCs</p>
                <p className="text-4xl font-bold mt-2">{nodes.length}</p>
              </div>
              <Monitor size={40} className="text-blue-200" />
            </div>
          </div>

          <div className="bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-xl p-6 text-white">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-emerald-100 text-sm font-medium">Conectadas</p>
                <p className="text-4xl font-bold mt-2">{connectedCount}</p>
              </div>
              <Wifi size={40} className="text-emerald-200" />
            </div>
          </div>

          <div className="bg-gradient-to-br from-red-500 to-red-600 rounded-xl p-6 text-white">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-red-100 text-sm font-medium">Desconectadas</p>
                <p className="text-4xl font-bold mt-2">{disconnectedCount}</p>
              </div>
              <WifiOff size={40} className="text-red-200" />
            </div>
          </div>
        </div>
      )}

      {/* Found PC */}
      {foundPC && (
        <div className="bg-yellow-50 dark:bg-yellow-900/20 border-2 border-yellow-200 dark:border-yellow-800 rounded-xl p-6">
          <h3 className="text-lg font-bold text-yellow-800 dark:text-yellow-300 mb-4 flex items-center gap-2">
            <CheckCircle size={20} />
            PC Encontrada
          </h3>
          <div className="space-y-2">
            <p className="text-lg font-semibold text-gray-900 dark:text-gray-100">{foundPC.name}</p>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="font-medium text-gray-600 dark:text-gray-400">Hostname:</span>
                <p className="text-gray-900 dark:text-gray-100">{foundPC.hostname || 'N/A'}</p>
              </div>
              <div>
                <span className="font-medium text-gray-600 dark:text-gray-400">IP:</span>
                <p className="text-gray-900 dark:text-gray-100">{foundPC.ip || 'N/A'}</p>
              </div>
              <div>
                <span className="font-medium text-gray-600 dark:text-gray-400">Sistema Operativo:</span>
                <p className="text-gray-900 dark:text-gray-100">{foundPC.os || 'N/A'}</p>
              </div>
              <div>
                <span className="font-medium text-gray-600 dark:text-gray-400">Estado:</span>
                <p className={`font-semibold ${foundPC.status === 'connected' ? 'text-emerald-600' : 'text-red-600'}`}>
                  {foundPC.status === 'connected' ? '🟢 Conectada' : '🔴 Desconectada'}
                </p>
              </div>
              <div>
                <span className="font-medium text-gray-600 dark:text-gray-400">Grupo:</span>
                <p className="text-gray-900 dark:text-gray-100">{foundPC.group || 'Sin grupo'}</p>
              </div>
              {foundPC.cpu && (
                <div>
                  <span className="font-medium text-gray-600 dark:text-gray-400">CPU:</span>
                  <p className="text-gray-900 dark:text-gray-100">{foundPC.cpu}</p>
                </div>
              )}
              {foundPC.ram && (
                <div>
                  <span className="font-medium text-gray-600 dark:text-gray-400">RAM:</span>
                  <p className="text-gray-900 dark:text-gray-100">{foundPC.ram}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* PC List */}
      {nodes.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-4 flex items-center gap-2">
            <Monitor size={20} />
            Lista de PCs ({nodes.length})
          </h3>
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {nodes.map(node => (
              <div
                key={node.id}
                className={`p-4 rounded-lg border-l-4 ${
                  node.status === 'connected'
                    ? 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-500'
                    : 'bg-red-50 dark:bg-red-900/20 border-red-500'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <p className="font-semibold text-gray-900 dark:text-gray-100">{node.name}</p>
                    <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                      <span className="font-medium">Hostname:</span> {node.hostname || 'N/A'} | 
                      <span className="font-medium ml-2">IP:</span> {node.ip || 'N/A'} | 
                      <span className="font-medium ml-2">SO:</span> {node.os || 'N/A'}
                    </div>
                    {node.group && (
                      <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                        <span className="font-medium">Grupo:</span> {node.group}
                      </p>
                    )}
                  </div>
                  <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                    node.status === 'connected'
                      ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400'
                      : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400'
                  }`}>
                    {node.status === 'connected' ? '🟢 Conectada' : '🔴 Desconectada'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Log */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
        <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-4 flex items-center gap-2">
          <RefreshCw size={20} />
          Log de Operaciones
        </h3>
        <div
          ref={logRef}
          className="bg-gray-900 rounded-lg p-4 font-mono text-sm max-h-80 overflow-y-auto"
        >
          {logs.length === 0 ? (
            <p className="text-gray-500">No hay operaciones registradas</p>
          ) : (
            logs.map((log, index) => (
              <div
                key={index}
                className={`mb-1 ${
                  log.type === 'success' ? 'text-emerald-400' :
                  log.type === 'error' ? 'text-red-400' :
                  log.type === 'warning' ? 'text-yellow-400' :
                  'text-gray-300'
                }`}
              >
                <span className="text-gray-500">[{log.timestamp}]</span> {log.message}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
