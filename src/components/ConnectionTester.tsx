import { useState } from 'react';
import { ExternalServer } from '../types';
import { testServerConnection } from '../services/serverServiceRegistry';
import { notifyConnectionSuccess, notifyConnectionError } from '../services/notifications';
import {
  Wifi, WifiOff, RefreshCw, CheckCircle, AlertCircle, Clock,
  Server, Shield, Globe
} from 'lucide-react';

interface ConnectionTesterProps {
  server: ExternalServer;
  onTestComplete?: (success: boolean) => void;
}

export default function ConnectionTester({ server, onTestComplete }: ConnectionTesterProps) {
  const [testing, setTesting] = useState(false);
  const [result, setResult] = useState<{
    success: boolean;
    message: string;
    latency?: number;
  } | null>(null);

  const handleTest = async () => {
    setTesting(true);
    setResult(null);

    try {
      const testResult = await testServerConnection(server);
      setResult(testResult);

      if (testResult.success) {
        notifyConnectionSuccess(server.name);
      } else {
        notifyConnectionError(server.name, testResult.message);
      }

      if (onTestComplete) {
        onTestComplete(testResult.success);
      }
    } catch (error) {
      const errorMessage = {
        success: false,
        message: `Error inesperado: ${error}`,
      };
      setResult(errorMessage);
      notifyConnectionError(server.name, errorMessage.message);

      if (onTestComplete) {
        onTestComplete(false);
      }
    } finally {
      setTesting(false);
    }
  };

  const formatLatency = (ms?: number): string => {
    if (!ms) return '';
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(2)}s`;
  };

  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl p-5 border border-gray-200 dark:border-slate-700">
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-start gap-3">
          <div className="p-2 bg-blue-50 dark:bg-blue-900/30 rounded-lg">
            <Server size={20} className="text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-gray-900 dark:text-white">
              Probar Conexión
            </h3>
            <p className="text-sm text-gray-500 dark:text-slate-400">
              Verifica la conectividad con el servidor
            </p>
          </div>
        </div>
      </div>

      {/* Server Info */}
      <div className="mb-4 p-3 bg-gray-50 dark:bg-slate-700 rounded-lg">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
          <div className="flex items-center gap-2 text-gray-600 dark:text-slate-400">
            <Globe size={14} />
            <span className="font-mono">{server.url}</span>
          </div>
          <div className="flex items-center gap-2 text-gray-600 dark:text-slate-400">
            <Shield size={14} />
            <span>Usuario: {server.username}</span>
          </div>
          <div className="flex items-center gap-2 text-gray-600 dark:text-slate-400">
            <Server size={14} />
            <span>Tipo: {server.type}</span>
          </div>
        </div>
      </div>

      {/* Test Button */}
      <button
        onClick={handleTest}
        disabled={testing}
        className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
      >
        {testing ? (
          <>
            <RefreshCw size={18} className="animate-spin" />
            Probando conexión...
          </>
        ) : (
          <>
            <Wifi size={18} />
            Probar Conexión
          </>
        )}
      </button>

      {/* Result */}
      {result && (
        <div className={`mt-4 p-4 rounded-lg border-2 ${
          result.success
            ? 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800'
            : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
        }`}>
          <div className="flex items-start gap-3">
            {result.success ? (
              <CheckCircle className="text-emerald-600 dark:text-emerald-400 flex-shrink-0 mt-0.5" size={24} />
            ) : (
              <AlertCircle className="text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" size={24} />
            )}
            <div className="flex-1">
              <p className={`font-semibold ${
                result.success
                  ? 'text-emerald-700 dark:text-emerald-300'
                  : 'text-red-700 dark:text-red-300'
              }`}>
                {result.success ? '✓ Conexión Exitosa' : '✗ Error de Conexión'}
              </p>
              <p className="text-sm text-gray-600 dark:text-slate-400 mt-1">
                {result.message}
              </p>
              {result.latency && (
                <div className="flex items-center gap-2 mt-2 text-sm text-gray-500 dark:text-slate-500">
                  <Clock size={14} />
                  <span>Latencia: {formatLatency(result.latency)}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Connection Tips */}
      {!result && !testing && (
        <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
          <p className="text-xs text-blue-700 dark:text-blue-300 font-medium mb-2">
            💡 Consejos para la prueba de conexión:
          </p>
          <ul className="text-xs text-blue-600 dark:text-blue-400 space-y-1 list-disc list-inside">
            <li>Verifique que la URL del servidor sea correcta</li>
            <li>Asegúrese de que el servidor esté accesible desde su red</li>
            <li>Confirme que las credenciales sean válidas</li>
            <li>Si usa HTTPS, verifique que el certificado sea válido</li>
          </ul>
        </div>
      )}
    </div>
  );
}
