/**
 * comprobantes.ts — Comprobantes de entrega con firma electrónica tipográfica.
 * Crear y firmar pasa por la función serverless /api/comprobante; acá se leen
 * los propios, la firma del responsable y los correos de contacto.
 */
import { supabase } from './supabase';

export interface FirmaResponsable {
  nombre: string;
  dni: string;
  fuente: string;
}

export interface EquipoComprobante { nombre: string; tipo: string; marca: string; modelo: string; serial: string; etiqueta: string }

/** Contenido fijo de la constancia. Versión 1: un equipo; versión 2: varios, sucursal, sector y resguardo. */
export interface DatosComprobante {
  version: number;
  empresa: string;
  fecha: string;
  equipo?: EquipoComprobante;          // versión 1
  equipos?: EquipoComprobante[];       // versión 2
  sucursal?: string;
  sector?: string;
  resguardo?: string;
  usuario: { nombre: string; area: string; correo: string };
  responsable: { nombre: string; dni: string; fuente: string; correo: string };
  observaciones: string;
  conformidad: string;
}

export interface Comprobante {
  id: string;
  estado: 'pendiente' | 'firmado' | 'anulado';
  datos: DatosComprobante;
  hash_documento: string;
  created_at: string;
  firmado_nombre: string | null;
  firmado_dni: string | null;
  firmado_fuente: string | null;
  firmado_at: string | null;
  firmado_ip: string | null;
  hash_firma: string | null;
  visto_at: string | null;
}

/** Equipos de la constancia, sea cual sea su versión. */
export function equiposDe(datos: DatosComprobante): EquipoComprobante[] {
  return datos.equipos ?? (datos.equipo ? [datos.equipo] : []);
}

/** Estado para mostrar: pendiente → visto (el usuario abrió el enlace) → firmado. */
export type EstadoVisible = 'pendiente' | 'visto' | 'firmado' | 'anulado';

export function estadoVisible(c: { estado: Comprobante['estado']; visto_at?: string | null }): EstadoVisible {
  if (c.estado === 'pendiente' && c.visto_at) return 'visto';
  return c.estado;
}

export const ESTADO_COMPROBANTE: Record<EstadoVisible, { label: string; clase: string }> = {
  pendiente: { label: 'Pendiente de firma', clase: 'bg-amber-100 text-amber-700' },
  visto: { label: 'Visto, sin firmar', clase: 'bg-sky-100 text-sky-700' },
  firmado: { label: 'Firmado', clase: 'bg-emerald-100 text-emerald-700' },
  anulado: { label: 'Anulado', clase: 'bg-gray-100 text-gray-500' },
};

export interface ResumenComprobante {
  movement_id: number;
  token: string;
  estado: Comprobante['estado'];
  correo_destino: string | null;
  visto_at: string | null;
}

/** Fila del listado de comprobantes de entrega. */
export interface ComprobanteListado extends ResumenComprobante {
  movement_ids: number[] | null;
  id: string;
  datos: DatosComprobante;
  zammad_ticket_id: number | null;
  created_at: string;
  firmado_at: string | null;
  firmado_nombre: string | null;
}

async function token(): Promise<string | undefined> {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token;
}

async function llamar(init: RequestInit, query = ''): Promise<any> {
  let res: Response;
  try {
    res = await fetch(`/api/comprobante${query}`, init);
  } catch {
    throw new Error('No se pudo conectar con el servidor.');
  }
  const json = await res.json().catch(() => null);
  if (!res.ok || !json?.success) throw new Error(json?.error || `El servidor respondió HTTP ${res.status}.`);
  return json.data;
}

// ===== Firma del responsable de Sistemas =====
export async function obtenerMiFirma(): Promise<FirmaResponsable | null> {
  const { data } = await supabase.auth.getSession();
  const userId = data.session?.user.id;
  if (!userId) return null;
  const { data: fila } = await supabase.from('firmas_responsables').select('nombre, dni, fuente').eq('user_id', userId).maybeSingle();
  return fila ?? null;
}

export async function guardarMiFirma(firma: FirmaResponsable): Promise<void> {
  const { data } = await supabase.auth.getSession();
  const userId = data.session?.user.id;
  if (!userId) throw new Error('Sesión no válida: volvé a iniciar sesión.');
  const { error } = await supabase.from('firmas_responsables').upsert({ user_id: userId, ...firma });
  if (error) throw new Error('No se pudo guardar la firma. Intentá de nuevo más tarde.');
}

// ===== Correo de contacto de los usuarios =====
export async function correoGuardado(usuarioRef: string): Promise<string> {
  const { data } = await supabase.from('usuarios_contacto').select('correo').eq('usuario_ref', usuarioRef).maybeSingle();
  return data?.correo ?? '';
}

export async function guardarCorreo(usuarioRef: string, correo: string): Promise<void> {
  await supabase.from('usuarios_contacto').upsert({ usuario_ref: usuarioRef, correo });
}

// ===== Comprobantes =====
/** Resultado de crear (o reenviar) un comprobante: el envío por email puede fallar sin perder el comprobante. */
export interface ComprobanteCreado {
  token: string;
  estado: string;
  enviado: boolean;
  ticket?: string;
  error?: string;
}

/**
 * Crea la constancia de uno o varios movimientos (a la misma persona) y la envía
 * por email. Si ya existía sin enviar, reintenta el envío.
 */
export async function crearComprobante(
  movementIds: number | number[], correo: string, extra: { sucursal?: string; sector?: string } = {},
): Promise<ComprobanteCreado> {
  return llamar({
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${await token()}` },
    body: JSON.stringify({ accion: 'crear', movementIds: ([] as number[]).concat(movementIds), correo, ...extra }),
  });
}

// ===== Sucursales (tabla "Ubicacion", solo lectura) =====
export async function listarSucursales(): Promise<string[]> {
  const { data, error } = await supabase.from('Ubicacion').select('nombre').eq('activo', true).order('nombre');
  if (error || !data) return [];
  return data.map(u => String(u.nombre ?? '').trim()).filter(Boolean);
}

/** Comprobantes propios, por id de movimiento (para mostrar el estado en el historial). */
export async function comprobantesPorMovimiento(): Promise<Map<number, ResumenComprobante>> {
  const { data, error } = await supabase.from('comprobantes_entrega').select('movement_id, movement_ids, token, estado, correo_destino, visto_at');
  if (error || !data) return new Map();
  // Una constancia puede cubrir varios movimientos: cada uno apunta a la misma.
  const mapa = new Map<number, ResumenComprobante>();
  for (const c of data) {
    for (const id of (c.movement_ids as number[] | null) ?? [c.movement_id]) mapa.set(Number(id), c as ResumenComprobante);
  }
  return mapa;
}

/** Listado completo de los comprobantes propios, del más nuevo al más viejo. */
export async function listarComprobantes(): Promise<ComprobanteListado[]> {
  const { data, error } = await supabase
    .from('comprobantes_entrega')
    .select('id, movement_id, movement_ids, token, estado, correo_destino, visto_at, datos, zammad_ticket_id, created_at, firmado_at, firmado_nombre')
    .order('created_at', { ascending: false });
  if (error) throw new Error('No se pudieron cargar los comprobantes.');
  return (data ?? []) as ComprobanteListado[];
}

/** interno = lo abre Sistemas para verlo (no cuenta como "visto" por el usuario). */
export async function obtenerComprobante(tokenFirma: string, interno = false): Promise<Comprobante> {
  return llamar({ method: 'GET' }, `?token=${encodeURIComponent(tokenFirma)}${interno ? '&interno=1' : ''}`);
}

export async function firmarComprobante(tokenFirma: string, firma: FirmaResponsable & { acepto: boolean }): Promise<void> {
  await llamar({
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ accion: 'firmar', token: tokenFirma, ...firma }),
  });
}

/** Enlace público para firmar (o ver) un comprobante. */
export function enlaceComprobante(tokenFirma: string): string {
  return `${window.location.origin}/firmar/${tokenFirma}`;
}
