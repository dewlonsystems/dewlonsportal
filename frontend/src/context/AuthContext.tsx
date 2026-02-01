// src/context/AuthContext.tsx
'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { useRouter } from 'next/navigation';

// ✅ Get API base from environment
const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000';

export interface User {
  id: number;
  username: string;
  first_name: string;
  is_staff: boolean;
  is_superuser: boolean;
}

interface AuthContextType {
  user: User | null;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  // Fetch current user on app load
  useEffect(() => {
    const fetchUser = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/auth/user/`, {
          credentials: 'include',
        });
        if (res.ok) {
          const userData = await res.json();
          setUser(userData);
        }
      } catch (err) {
        console.error('Failed to fetch user:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchUser();
  }, []);

  const login = async (username: string, password: string) => {
    // Get CSRF token first
    await fetch(`${API_BASE}/api/auth/user/`, { credentials: 'include' });

    const csrfCookie = document.cookie
      .split('; ')
      .find(row => row.startsWith('csrftoken='))
      ?.split('=')[1];

    if (!csrfCookie) throw new Error('CSRF token missing');

    const res = await fetch(`${API_BASE}/api/auth/login/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRFToken': csrfCookie,
      },
      credentials: 'include',
      body: JSON.stringify({ username, password }),
    });

    if (res.ok) {
      const userData = await res.json();
      setUser(userData);
      if (userData.is_superuser || userData.is_staff) {
        router.push('/dashboard');
      }
    } else {
      const error = await res.json();
      throw new Error(error.error || 'Login failed');
    }
  };

  const logout = async () => {
    const csrfCookie = document.cookie
      .split('; ')
      .find(row => row.startsWith('csrftoken='))
      ?.split('=')[1];

    await fetch(`${API_BASE}/api/auth/logout/`, {
      method: 'POST',
      headers: {
        'X-CSRFToken': csrfCookie || '',
      },
      credentials: 'include',
    });

    setUser(null);
    router.push('/login');
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}