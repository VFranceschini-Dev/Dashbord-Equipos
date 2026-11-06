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

export interface DatosComprobante {
  version: number;
  empresa: string;
  fecha: string;
  equipo: { nombre: string; tipo: string; marca: string; modelo: string; serial: string; etiqueta: string };
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
}

export interface ResumenComprobante {
  movement_id: number;
  token: string;
  estado: Comprobante['estado'];
  correo_destino: string | null;
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

/** Crea el comprobante y lo envía por email. Si ya existía sin enviar, reintenta el envío. */
export async function crearComprobante(movementId: number, correo: string): Promise<ComprobanteCreado> {
  return llamar({
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${await token()}` },
    body: JSON.stringify({ accion: 'crear', movementId, correo }),
  });
}

/** Comprobantes propios, por id de movimiento (para mostrar el estado en el historial). */
export async function comprobantesPorMovimiento(): Promise<Map<number, ResumenComprobante>> {
  const { data, error } = await supabase.from('comprobantes_entrega').select('movement_id, token, estado, correo_destino');
  if (error || !data) return new Map();
  return new Map(data.map(c => [Number(c.movement_id), c as ResumenComprobante]));
}

export async function obtenerComprobante(tokenFirma: string): Promise<Comprobante> {
  return llamar({ method: 'GET' }, `?token=${encodeURIComponent(tokenFirma)}`);
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
