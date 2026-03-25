"use client";

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useRouter } from 'next/navigation';

interface AuthUser { email: string; }

interface AuthContextType {
  isAuthenticated: boolean;
  user: AuthUser | null;
  login: (token: string) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

/** Decode the email from a JWT payload (base64url) without a library */
function decodeEmail(token: string): string | null {
  try {
    const payload = token.split('.')[1];
    const decoded = JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')));
    return decoded.email ?? null;
  } catch { return null; }
}

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user,            setUser]            = useState<AuthUser | null>(null);
  const [loading,         setLoading]         = useState(true);
  const router = useRouter();

  useEffect(() => {
    const token = localStorage.getItem('authToken');
    if (token) {
      const email = decodeEmail(token);
      setIsAuthenticated(true);
      setUser(email ? { email } : null);
    }
    setLoading(false);
  }, []);

  const login = (token: string) => {
    localStorage.setItem('authToken', token);
    const email = decodeEmail(token);
    setIsAuthenticated(true);
    setUser(email ? { email } : null);
    router.push('/dashboard');
  };

  const logout = () => {
    localStorage.removeItem('authToken');
    setIsAuthenticated(false);
    setUser(null);
    router.push('/');
  };

  if (loading) {
    return (
      <div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', background:'var(--bg-base)' }}>
        <span className="spinner" />
      </div>
    );
  }

  return (
    <AuthContext.Provider value={{ isAuthenticated, user, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};
