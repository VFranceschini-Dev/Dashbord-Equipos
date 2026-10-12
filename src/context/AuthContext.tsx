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

    getSessionProfile()
      .then(profile => {
        if (mounted) setUser(profile);
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    // Mantener el estado sincronizado ante cambios de sesión/token.
    const unsubscribe = onAuthStateChange(session => {
      if (!session) {
        setUser(null);
      } else {
        getSessionProfile().then(profile => {
          if (mounted) setUser(profile);
        });
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
    setUser(profile);
  }, []);

  const logout = useCallback(async (): Promise<void> => {
    await supabaseSignOut();
    setUser(null);
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
