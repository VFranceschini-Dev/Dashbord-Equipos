import { useState } from 'react';
import { meshCentralService } from '../services/meshCentral';
import { Server, Key, Wifi, WifiOff, RefreshCw, CheckCircle, AlertCircle, Info, ExternalLink, Settings } from 'lucide-react';

interface MeshConfigProps {
  onConfigured: () => void;
}

export default function MeshConfig({ onConfigured }: MeshConfigProps) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [testing, setTesting] = useState(false);
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');

  const existingCreds = meshCentralService.getCredentials();

  const handleSave = () => {
    if (!username || !password) {
      setStatus('error');
      setMessage('Complete todos los campos');
      return;
    }
    meshCentralService.setCredentials(username, password);
    setStatus('success');
    setMessage('Credenciales guardadas');
    setTimeout(() => onConfigured(), 1000);
  };

  const handleTest = async () => {
    if (!username || !password) {
      setStatus('error');
      setMessage('Complete las credenciales antes de probar');
      return;
    }

    setTesting(true);
    setStatus('idle');
    setMessage('');

    meshCentralService.setCredentials(username, password);
    const connected = await meshCentralService.connect();

    if (connected) {
      setStatus('success');
      setMessage('Conexión exitosa con MeshCentral');
    } else {
      setStatus('error');
      setMessage('No se pudo conectar. Verifique las credenciales y que el servidor MeshCentral tenga AllowLoginToken habilitado.');
    }
    setTesting(false);
  };

  const handleDisconnect = () => {
    meshCentralService.disconnect();
    localStorage.removeItem('mesh_username');
    localStorage.removeItem('mesh_password');
    setUsername('');
    setPassword('');
    setStatus('idle');
    setMessage('');
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-slate-800 to-slate-900 p-5">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-white/10 rounded-xl border border-white/20">
            <Settings className="w-6 h-6 text-white" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-white">Configuración MeshCentral</h3>
            <p className="text-sm text-slate-300">Conectar con mesh.donnet.com.ar</p>
          </div>
        </div>
      </div>

      <div className="p-6 space-y-5">
        {/* Estado de conexión */}
        <div className={`flex items-center gap-3 p-3 rounded-xl border ${
          meshCentralService.isConnected() 
            ? 'bg-emerald-50 border-emerald-200' 
            : 'bg-gray-50 border-gray-200'
        }`}>
          {meshCentralService.isConnected() ? (
            <Wifi className="w-5 h-5 text-emerald-600" />
          ) : (
            <WifiOff className="w-5 h-5 text-gray-400" />
          )}
          <div className="flex-1">
            <p className={`text-sm font-medium ${meshCentralService.isConnected() ? 'text-emerald-700' : 'text-gray-600'}`}>
              {meshCentralService.isConnected() ? 'Conectado a MeshCentral' : 'Desconectado'}
            </p>
            <p className="text-xs text-gray-400">
              {meshCentralService.isConnected() 
                ? `Última actualización: ${meshCentralService.getLastUpdate().toLocaleTimeString('es-AR')}`
                : 'Configure las credenciales para conectar'}
            </p>
          </div>
        </div>

        {/* Credenciales existentes */}
        {existingCreds && !username && (
          <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Key className="w-4 h-4 text-blue-600" />
                <span className="text-sm text-blue-700">
                  Credenciales guardadas: <strong>{existingCreds.username}</strong>
                </span>
              </div>
              <button 
                onClick={handleDisconnect}
                className="text-xs text-red-600 hover:text-red-700 font-medium"
              >
                Desconectar
              </button>
            </div>
          </div>
        )}

        {/* Formulario */}
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Usuario MeshCentral
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent focus:bg-white outline-none transition-all text-sm"
              placeholder="admin"
              defaultValue={existingCreds?.username}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Contraseña MeshCentral
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent focus:bg-white outline-none transition-all text-sm"
              placeholder="••••••••"
            />
          </div>
        </div>

        {/* Mensaje de estado */}
        {message && (
          <div className={`flex items-center gap-2 p-3 rounded-xl text-sm ${
            status === 'success' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
            status === 'error' ? 'bg-red-50 text-red-700 border border-red-200' :
            'bg-gray-50 text-gray-700 border border-gray-200'
          }`}>
            {status === 'success' ? <CheckCircle size={16} /> : 
             status === 'error' ? <AlertCircle size={16} /> : 
             <Info size={16} />}
            {message}
          </div>
        )}

        {/* Botones */}
        <div className="flex gap-2">
          <button
            onClick={handleTest}
            disabled={testing || !username || !password}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200 transition-colors text-sm font-medium disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${testing ? 'animate-spin' : ''}`} />
            {testing ? 'Probando...' : 'Probar Conexión'}
          </button>
          <button
            onClick={handleSave}
            disabled={!username || !password}
            className="flex-1 px-4 py-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors text-sm font-medium disabled:opacity-50"
          >
            Guardar y Conectar
          </button>
        </div>

        {/* Instrucciones del servidor */}
        <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl">
          <div className="flex items-start gap-2">
            <Info className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
            <div className="text-xs text-amber-800 space-y-2">
              <p className="font-semibold">Requisitos del servidor MeshCentral:</p>
              <p>El administrador del servidor MeshCentral debe configurar:</p>
              <ol className="list-decimal list-inside space-y-1 ml-1">
                <li>Editar <code className="bg-amber-100 px-1 rounded">config.json</code> del servidor</li>
                <li>Agregar <code className="bg-amber-100 px-1 rounded">"allowFraming": true</code> en settings</li>
                <li>Agregar <code className="bg-amber-100 px-1 rounded">"AllowLoginToken": true</code> en settings</li>
                <li>Reiniciar el servicio MeshCentral</li>
              </ol>
              <a 
                href="https://mesh.donnet.com.ar" 
                target="_blank" 
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-amber-700 hover:text-amber-800 font-medium mt-1"
              >
                Abrir MeshCentral <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
