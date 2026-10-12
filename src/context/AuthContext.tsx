import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import {
  AuthUserProfile,
  signInWithPassword,
  signOut as supabaseSignOut,
  getSessionProfile,
  onAuthStateChange,
} from '../services/authService';

interface AuthContextType {
  user: AuthUserProfile | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUserProfile | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  // Al montar, restaurar la sesión de Supabase Auth (el token persiste automáticamente).
  useEffect(() => {
    let mounted = true;

    const applyProfile = (profile: AuthUserProfile | null) => {
      if (!mounted) return;
      // Mantener 'current_user_id' sincronizado para los servicios de supabaseSync.
      if (profile) {
        localStorage.setItem('current_user_id', profile.id);
      } else {
        localStorage.removeItem('current_user_id');
      }
      setUser(profile);
    };

    getSessionProfile()
      .then(applyProfile)
      .finally(() => {
        if (mounted) setLoading(false);
      });

    // Mantener el estado sincronizado ante cambios de sesión/token.
    const unsubscribe = onAuthStateChange((event, session) => {
      if (!session) {
        // IMPORTANTE: supabase-js dispara INITIAL_SESSION (con sesión válida)
        // y luego SIGNED_OUT al cerrar sesión en OTRA pestaña. Si ignoráramos
        // INITIAL_SESSION, la última notificación (SIGNED_OUT) desloguearía al
        // usuario recién restaurado. Por eso solo se reacciona a los eventos
        // explícitos de cierre/apertura de sesión.
        if (event === 'SIGNED_OUT') {
          applyProfile(null);
        }
        return;
      }
      if (event === 'SIGNED_IN' || event === 'USER_UPDATED' || event === 'INITIAL_SESSION') {
        getSessionProfile().then(applyProfile);
      }
    });

    return () => {
      mounted = false;
      unsubscribe();
    };
  }, []);

  const login = useCallback(async (email: string, password: string): Promise<void> => {
    // Lanza Error si las credenciales son inválidas; el llamador debe manejarlo.
    const profile = await signInWithPassword(email, password);
    // Retrocompatibilidad: los servicios de sincronización leen 'current_user_id'
    // de localStorage para filtrar datos por usuario en Supabase.
    localStorage.setItem('current_user_id', profile.id);
    setUser(profile);
    setLoading(false);
  }, []);

  const logout = useCallback(async (): Promise<void> => {
    await supabaseSignOut();
    localStorage.removeItem('current_user_id');
    setUser(null);
    setLoading(false);
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, isAuthenticated: !!user }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}
