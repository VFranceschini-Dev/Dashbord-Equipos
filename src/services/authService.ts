los metadatos del usuario de Supabase Auth.
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

    if (!error && data) {
      return {
        id: user.id,
        email: user.email ?? '',
        name: (data.full_name as string) || fallbackName,
        role: data.role === 'admin' ? 'admin' : 'user',
      };
    }
  } catch {
    // La tabla profiles puede no existir todavía: usar metadatos de auth.
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
  callback: (session: Session | null) => void
): () => void {
  const { data } = supabase.auth.onAuthStateChange((_event, session) => {
    callback(session);
  });
  return () => data.subscription.unsubscribe();
}

// Re-export de tipos para comodidad de los consumidores
export type { User as SupabaseUser };