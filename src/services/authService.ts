import { Session, User } from '@supabase/supabase-js';
import { supabase } from './supabase';

export interface AuthUserProfile {
  id: string;
  email: string;
  name: string;
  role: 'admin' | 'user';
  area?: string;
  /** false si el perfil está desactivado en perfiles_usuarios */
  activo: boolean;
}

/**
 * Obtiene el perfil del usuario desde la tabla `public.perfiles_usuarios`
 * (id = id del usuario de Supabase Auth). Si no tiene perfil, devuelve uno por
 * defecto derivado de los metadatos de Supabase Auth.
 */
async function getProfile(session: Session): Promise<AuthUserProfile> {
  const user = session.user;
  const fallbackName =
    (user.user_metadata?.full_name as string) ||
    (user.user_metadata?.name as string) ||
    user.email?.split('@')[0] ||
    'Usuario';

  try {
    const { data, error } = await supabase
      .from('perfiles_usuarios')
      .select('nombre, rol, area, activo')
      .eq('id', user.id)
      .maybeSingle();

    if (error) {
      console.warn('[authService] Error consultando perfiles_usuarios:', error.message);
    } else if (data) {
      return {
        id: user.id,
        email: user.email ?? '',
        name: (data.nombre as string)?.trim() || fallbackName,
        role: String(data.rol ?? '').toLowerCase() === 'admin' ? 'admin' : 'user',
        area: (data.area as string) || undefined,
        activo: data.activo !== false,
      };
    }
  } catch (err) {
    console.warn('[authService] Excepción consultando perfiles_usuarios:', err);
  }

  const appRole = user.app_metadata?.role;
  return {
    id: user.id,
    email: user.email ?? '',
    name: fallbackName,
    role: appRole === 'admin' ? 'admin' : 'user',
    activo: true,
  };
}

/**
 * Inicia sesión con Supabase Auth (email + contraseña).
 */
export async function signInWithPassword(
  email: string,
  password: string
): Promise<AuthUserProfile> {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error || !data.session) {
    throw new Error(error?.message || 'Credenciales inválidas');
  }

  return getProfile(data.session);
}

/**
 * Cierra la sesión actual de Supabase Auth.
 */
export async function signOut(): Promise<void> {
  await supabase.auth.signOut();
}

/**
 * Recupera la sesión existente (por ejemplo, al recargar la página).
 */
export async function getSessionProfile(): Promise<AuthUserProfile | null> {
  const { data, error } = await supabase.auth.getSession();
  if (error || !data.session) return null;
  return getProfile(data.session);
}

/**
 * Suscripción a cambios de estado de autenticación.
 * Devuelve la función para cancelar la suscripción.
 */
export function onAuthStateChange(
  callback: (event: string, session: Session | null) => void
): () => void {
  const { data } = supabase.auth.onAuthStateChange((event, session) => {
    callback(event, session);
  });
  return () => data.subscription.unsubscribe();
}

// Re-export de tipos para comodidad de los consumidores
export type { User as SupabaseUser };
