import { Session, User } from '@supabase/supabase-js';
import { supabase } from './supabase';

export interface AuthUserProfile {
  id: string;
  email: string;
  name: string;
  role: 'admin' | 'user';
}

/**
 * Obtiene el perfil del usuario desde la tabla `public.profiles`.
 * Si la tabla no existe o no hay registro, devuelve un perfil por defecto
 * derivado de los metadatos del usuario de Supabase Auth.
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
      .from('profiles')
      .select('id, full_name, role')
      .eq('id', user.id)
      .maybeSingle();

    // Si la consulta falla porque la tabla profiles aún no existe
    // (code 42P01 = undefined_table en Postgres), se usa el fallback.
    // Cualquier otro error (p. ej. RLS mal configurada) se registra para diagnóstico.
    if (error) {
      const code = (error as { code?: string }).code;
      if (code !== '42P01') {
        console.warn('[authService] Error consultando profiles:', error.message);
      }
    } else if (data) {
      return {
        id: user.id,
        email: user.email ?? '',
        name: (data.full_name as string) || fallbackName,
        role: data.role === 'admin' ? 'admin' : 'user',
      };
    }
  } catch (err) {
    // La tabla profiles puede no existir todavía: usar metadatos de auth.
    console.warn('[authService] Excepción consultando profiles:', err);
  }

  const appRole = user.app_metadata?.role;
  return {
    id: user.id,
    email: user.email ?? '',
    name: fallbackName,
    role: appRole === 'admin' ? 'admin' : 'user',
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
