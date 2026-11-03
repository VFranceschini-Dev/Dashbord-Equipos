/**
 * mesh.ts — Sincronización de PC y notebooks desde el servidor de monitoreo
 * remoto. La consulta la hace la función serverless /api/mesh (las
 * credenciales nunca llegan al navegador); acá solo se guardan los equipos.
 */
import { supabase } from './supabase';

const TIMEOUT_MS = 30000; // la función espera hasta 20 s al servidor de monitoreo

export interface EquipoMesh {
  meshNodeId: string;
  nombre: string;
  tipo: 'desktop' | 'laptop';
  so: string;
  ip: string;
  sector: string;
  enLinea: boolean;
  ultimaConexion: string | null;
}

export interface ResultadoSincronizacion {
  nuevos: number;
  actualizados: number;
  ignorados: number;
  errores: number;
}

async function obtenerEquiposMesh(token: string): Promise<{ data: EquipoMesh[]; ignorados: number }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  let res: Response;
  try {
    res = await fetch('/api/mesh', { headers: { Authorization: `Bearer ${token}` }, signal: controller.signal });
  } catch (err) {
    throw new Error((err as Error).name === 'AbortError'
      ? 'El servidor de monitoreo no respondió a tiempo.'
      : 'No se pudo conectar con el servidor.');
  } finally {
    clearTimeout(timer);
  }
  let json: any;
  try {
    json = await res.json();
  } catch {
    throw new Error(`Respuesta inválida del servidor (HTTP ${res.status}).`);
  }
  if (!res.ok || !json?.success) throw new Error(json?.error || `El servidor respondió HTTP ${res.status}.`);
  return { data: json.data || [], ignorados: json.ignorados || 0 };
}

/**
 * Crea los equipos nuevos y, en los existentes (mismo id de monitoreo),
 * actualiza solo los datos que vienen del servidor de monitoreo: nombre, SO,
 * IP, sector, en línea y última conexión. Marca, modelo, serial, tipo, estado
 * y asignación no se tocan. Los equipos que ya no aparecen no se borran.
 */
export async function sincronizarConMesh(): Promise<ResultadoSincronizacion> {
  const { data: sesion } = await supabase.auth.getSession();
  const token = sesion.session?.access_token;
  const userId = sesion.session?.user.id;
  if (!token || !userId) throw new Error('Sesión no válida: volvé a iniciar sesión.');

  const { data: equipos, ignorados } = await obtenerEquiposMesh(token);
  const ahora = new Date().toISOString();

  const { data: existentes, error } = await supabase
    .from('equipments')
    .select('id, mesh_node_id')
    .eq('user_id', userId)
    .not('mesh_node_id', 'is', null);
  if (error) throw new Error('No se pudieron leer los equipos guardados.');
  const idPorNodo = new Map((existentes || []).map(e => [e.mesh_node_id as string, e.id as string]));

  const datosMesh = (e: EquipoMesh) => ({
    name: e.nombre,
    mesh_so: e.so,
    mesh_ip: e.ip,
    mesh_grupo: e.sector,
    mesh_en_linea: e.enLinea,
    mesh_ultima_conexion: e.ultimaConexion,
    mesh_sincronizado: ahora,
  });

  const nuevos = equipos.filter(e => !idPorNodo.has(e.meshNodeId));
  const aActualizar = equipos.filter(e => idPorNodo.has(e.meshNodeId));
  let erroresAlta = 0;
  let erroresActualizacion = 0;

  if (nuevos.length > 0) {
    const { error: errAlta } = await supabase.from('equipments').insert(nuevos.map(e => ({
      ...datosMesh(e),
      user_id: userId,
      type: e.tipo,
      category: 'Informática',
      status: 'available',
      mesh_node_id: e.meshNodeId,
    })));
    if (errAlta) erroresAlta = nuevos.length; // el insert es todo o nada
  }

  // Actualizaciones de a 10 en paralelo
  for (let i = 0; i < aActualizar.length; i += 10) {
    const lote = aActualizar.slice(i, i + 10);
    const resultados = await Promise.all(lote.map(e =>
      supabase.from('equipments').update(datosMesh(e)).eq('id', idPorNodo.get(e.meshNodeId)!)));
    erroresActualizacion += resultados.filter(r => r.error).length;
  }

  return {
    nuevos: nuevos.length - erroresAlta,
    actualizados: aActualizar.length - erroresActualizacion,
    ignorados,
    errores: erroresAlta + erroresActualizacion,
  };
}
