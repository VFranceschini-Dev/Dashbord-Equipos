import { useEffect, useMemo, useState } from 'react';
import { useApp } from '../context/AppContext';
import * as db from '../services/localDatabase';
import { estadoMesh, sincronizarConMesh } from '../services/mesh';
import {
  Server, RefreshCw, Loader2, Globe, Clock, Monitor, Wifi, AlertCircle, CheckCircle, Trash2, Shield
} from 'lucide-react';

/**
 * Servidores: estado de la conexión con el servidor de monitoreo remoto.
 * Las credenciales viven solo en el servidor (variables de entorno): esta
 * pantalla nunca muestra ni pide usuario o contraseña.
 */
export default function ServerConfig() {
  const { equipments, refreshModule } = useApp();
  const [estado, setEstado] = useState<{ configurado: boolean; host: string } | null>(null);
  const [estadoError, setEstadoError] = useState<string | null>(null);
  const [sincronizando, setSincronizando] = useState(false);
  const [resultado, setResultado] = useState<{ ok: boolean; text: string } | null>(null);
  const [anteriores, setAnteriores] = useState(() => db.getServers().length);

  useEffect(() => {
    estadoMesh()
      .then(setEstado)
      .catch(err => setEstadoError((err as Error).message));
  }, []);

  // Resumen a partir de los equipos ya sincronizados
  const resumen = useMemo(() => {
    const sincronizados = equipments.filter(e => e.meshNodeId);
    const ultima = sincronizados
      .map(e => e.meshSincronizado)
      .filter((f): f is string => Boolean(f))
      .sort()
      .pop();
    return {
      total: sincronizados.length,
      enLinea: sincronizados.filter(e => e.meshEnLinea).length,
      ultima: ultima ? new Date(ultima).toLocaleString('es-AR') : null,
    };
  }, [equipments]);

  const handleSincronizar = async () => {
    setSincronizando(true);
    setResultado(null);
    try {
      const r = await sincronizarConMesh();
      await refreshModule('equipments');
      setResultado({
        ok: r.errores === 0,
        text: `Sincronización: ${r.nuevos} nuevos, ${r.actualizados} actualizados, ${r.ignorados} ignorados (no son PC ni notebook)`
          + (r.errores ? `, ${r.errores} con error.` : '.'),
      });
    } catch (err) {
      setResultado({ ok: false, text: (err as Error).message });
    } finally {
      setSincronizando(false);
    }
  };

  // Configuración anterior: servidores con usuario y contraseña guardados en este navegador
  const borrarAnteriores = () => {
    db.getServers().forEach(s => db.deleteServer(s.id));
    setAnteriores(0);
  };

  const conectado = resultado ? resultado.ok : null;

  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-r from-slate-800 to-slate-900 rounded-2xl p-6 text-white flex items-center gap-4">
        <div className="p-3 bg-white/10 rounded-xl"><Server size={28} /></div>
        <div>
          <h2 className="text-2xl font-bold">Servidor de monitoreo</h2>
          <p className="text-sm text-slate-300">Sincronización de PC y notebooks con MeshCentral</p>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 space-y-4">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl text-white"><Server size={22} /></div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-gray-800 text-lg">MeshCentral</h3>
                {estado && (estado.configurado ? (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-emerald-50 text-emerald-700 border border-emerald-200">
                    <CheckCircle size={12} /> Configurado
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-amber-50 text-amber-700 border border-amber-200">
                    <AlertCircle size={12} /> Sin configurar
                  </span>
                ))}
              </div>
              <p className="text-sm text-gray-500 flex items-center gap-1.5 mt-0.5">
                <Globe size={14} /> {estado?.host || (estadoError ? '—' : 'Consultando...')}
              </p>
            </div>
          </div>
          <button onClick={handleSincronizar} disabled={sincronizando || estado?.configurado === false}
            className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 text-sm font-medium disabled:opacity-60">
            {sincronizando ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />} Sincronizar ahora
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="rounded-lg bg-gray-50 p-3">
            <p className="text-xs text-gray-500 flex items-center gap-1"><Monitor size={12} /> Equipos sincronizados</p>
            <p className="text-xl font-bold text-gray-800">{resumen.total}</p>
          </div>
          <div className="rounded-lg bg-gray-50 p-3">
            <p className="text-xs text-gray-500 flex items-center gap-1"><Wifi size={12} /> En línea (última sincronización)</p>
            <p className="text-xl font-bold text-emerald-700">{resumen.enLinea}</p>
          </div>
          <div className="rounded-lg bg-gray-50 p-3">
            <p className="text-xs text-gray-500 flex items-center gap-1"><Clock size={12} /> Última sincronización</p>
            <p className="text-sm font-semibold text-gray-800 mt-1">{resumen.ultima || 'Nunca'}</p>
          </div>
        </div>

        {conectado !== null && resultado && (
          <div className={`rounded-lg px-3 py-2 text-sm ${resultado.ok ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>
            {resultado.text}
          </div>
        )}
        {estadoError && (
          <div className="rounded-lg px-3 py-2 text-sm bg-red-50 text-red-700">{estadoError}</div>
        )}
        {estado?.configurado === false && (
          <div className="rounded-lg px-3 py-2 text-sm bg-amber-50 text-amber-800">
            Falta configurar el servidor de monitoreo (variables MESH_URL, MESH_USER y MESH_PASS en Vercel).
          </div>
        )}

        <p className="text-xs text-gray-400 flex items-center gap-1.5">
          <Shield size={12} /> Las credenciales se guardan solo en el servidor; esta pantalla no las muestra.
        </p>
      </div>

      {anteriores > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start justify-between gap-4 flex-wrap">
          <div className="text-sm text-amber-800">
            <p className="font-medium">Configuración anterior guardada en este navegador</p>
            <p>
              Hay {anteriores} servidor{anteriores !== 1 ? 'es' : ''} con usuario y contraseña guardados en este navegador
              por la versión anterior de esta pantalla. Ya no se usan.
            </p>
          </div>
          <button onClick={borrarAnteriores}
            className="flex items-center gap-2 bg-white border border-amber-300 text-amber-800 px-3 py-1.5 rounded-lg hover:bg-amber-100 text-sm font-medium">
            <Trash2 size={14} /> Eliminar de este navegador
          </button>
        </div>
      )}
    </div>
  );
}
