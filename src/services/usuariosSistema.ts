/**
 * usuariosSistema.ts — Administración de los usuarios que inician sesión (solo administradores).
 * Todo pasa por la función serverless /api/usuarios-sistema.
 */
import { supabase } from './supabase';
import type { Permisos, Rol } from '../config/permisos';

export interface UsuarioSistema {
  id: string;
  nombre: string;
  email: string;
  rol: Rol;
  area: string;
  activo: boolean;
  permisos: Permisos;
  created_at: string | null;
}

export interface AltaUsuarioSistema {
  nombre: string;
  email: string;
  /** Alta desde el directorio: el servidor toma nombre y correo de Zammad. */
  zammad_id?: number;
  password: string;
  rol: Rol;
  area: string;
  permisos: Permisos;
}

export interface CambiosUsuarioSistema {
  nombre?: string;
  area?: string;
  rol?: Rol;
  activo?: boolean;
  permisos?: Permisos;
  password?: string;
}

async function llamar(method: 'GET' | 'POST' | 'PATCH' | 'DELETE', body?: unknown): Promise<any> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  let res: Response;
  try {
    res = await fetch('/api/usuarios-sistema', {
      method,
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new Error('No se pudo conectar con el servidor.');
  }
  const json = await res.json().catch(() => null);
  if (!res.ok || !json?.success) throw new Error(json?.error || `El servidor respondió HTTP ${res.status}.`);
  return json;
}

export async function listarUsuariosSistema(): Promise<UsuarioSistema[]> {
  return (await llamar('GET')).data;
}

export async function crearUsuarioSistema(alta: AltaUsuarioSistema): Promise<UsuarioSistema> {
  return (await llamar('POST', alta)).data;
}

export async function actualizarUsuarioSistema(id: string, cambios: CambiosUsuarioSistema): Promise<{ usuario: UsuarioSistema; aviso?: string }> {
  const json = await llamar('PATCH', { id, ...cambios });
  return { usuario: json.data, aviso: json.aviso };
}

/** Baja definitiva de un usuario desactivado. Sus datos pasan al administrador que lo elimina. */
export async function eliminarUsuarioSistema(id: string, confirmar: string): Promise<{ email: string; reasignado: Record<string, number>; aviso?: string }> {
  const json = await llamar('DELETE', { id, confirmar });
  return { email: json.data.email, reasignado: json.data.reasignado ?? {}, aviso: json.aviso };
}

export interface UsuarioDirectorio {
  zammadId: number;
  login: string;
  nombre: string;
  email: string;
  yaTieneCuenta: boolean;
}

/** Busca en el directorio (Zammad) personas de las organizaciones habilitadas. */
export async function buscarUsuariosDirectorio(q: string): Promise<{ usuarios: UsuarioDirectorio[]; total: number }> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  let res: Response;
  try {
    res = await fetch(`/api/zammad-usuarios?q=${encodeURIComponent(q)}`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
  } catch {
    throw new Error('No se pudo conectar con el servidor.');
  }
  const json = await res.json().catch(() => null);
  if (!res.ok || !json?.success) throw new Error(json?.error || `El servidor respondió HTTP ${res.status}.`);
  return { usuarios: json.data, total: json.total ?? json.data.length };
}
