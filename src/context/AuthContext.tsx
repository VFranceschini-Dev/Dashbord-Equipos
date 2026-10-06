import React, { createContext, useContext, useState, ReactNode } from 'react';

interface User {
  email: string;
  name: string;
  role: 'admin' | 'user';
}

interface AuthContextType {
  user: User | null;
  login: (email: string, password: string) => boolean;
  logout: () => void;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const DEFAULT_USERS = [
  { email: 'soporte@donnet.com.ar', password: 'Admin2024!Seguro', name: 'Administrador', role: 'admin' as const },
  { email: 'usuario@donnet.com.ar', password: 'User2024!Test', name: 'Ana García', role: 'user' as const },
];

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(() => {
    const savedUser = localStorage.getItem('toner_user');
    return savedUser ? JSON.parse(savedUser) : null;
  });

  const login = (email: string, password: string): boolean => {
    const foundUser = DEFAULT_USERS.find(
      u => u.email === email && u.password === password
    );
    
    if (foundUser) {
      const userData = { email: foundUser.email, name: foundUser.name, role: foundUser.role };
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
