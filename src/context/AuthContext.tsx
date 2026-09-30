import React, { createContext, useContext, useState, ReactNode } from 'react';

interface User {
  username: string;
  name: string;
  role: 'admin' | 'user';
}

interface AuthContextType {
  user: User | null;
  login: (username: string, password: string) => boolean;
  logout: () => void;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Credenciales por defecto
const DEFAULT_USERS = [
  { username: 'admin', password: 'admin123', name: 'Carlos Méndez', role: 'admin' as const },
  { username: 'usuario', password: 'user123', name: 'Ana García', role: 'user' as const },
];

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(() => {
    // Verificar si hay sesión guardada
    const savedUser = localStorage.getItem('toner_user');
    return savedUser ? JSON.parse(savedUser) : null;
  });

  const login = (username: string, password: string): boolean => {
    const foundUser = DEFAULT_USERS.find(
      u => u.username === username && u.password === password
    );
    
    if (foundUser) {
      const userData = { username: foundUser.username, name: foundUser.name, role: foundUser.role };
      setUser(userData);
      localStorage.setItem('toner_user', JSON.stringify(userData));
      return true;
    }
    return false;
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem('toner_user');
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, isAuthenticated: !!user }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}
