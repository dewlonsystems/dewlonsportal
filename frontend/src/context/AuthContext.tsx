// src/context/AuthContext.tsx
'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { usePathname } from 'next/navigation';

// ✅ API base URL
const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000';

// ✅ User type
export interface User {
  id: number;
  username: string;
  first_name: string;
  is_staff: boolean;
  is_superuser: boolean;
}

// ✅ Context shape
interface AuthContextType {
  user: User | null;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  loading: boolean;
}

// ✅ Create context
const AuthContext = createContext<AuthContextType | undefined>(undefined);

// ✅ Protected route prefixes — extend this as needed
const PROTECTED_ROUTE_PREFIXES = ['/dashboard', '/admin', '/profile', '/settings'];

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const pathname = usePathname();

  useEffect(() => {
    // ✅ Determine if current route requires authentication
    const isProtectedRoute = PROTECTED_ROUTE_PREFIXES.some((prefix) =>
      pathname?.startsWith(prefix)
    );

    // 🔓 Public route: skip auth initialization entirely
    if (!isProtectedRoute) {
      setLoading(false);
      return;
    }

    // 🔒 Protected route: fetch user session
    const fetchUser = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/auth/user/`, {
          credentials: 'include',
        });

        if (res.ok) {
          const userData = await res.json();
          setUser(userData);
        }
        // If not ok, user remains null → handled by page-level redirect
      } catch (err) {
        console.error('Failed to fetch user:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchUser();
  }, [pathname]);

  // ✅ Login function — no redirect
  const login = async (username: string, password: string) => {
    // Get CSRF token
    await fetch(`${API_BASE}/api/auth/user/`, { credentials: 'include' });

    const csrfCookie = document.cookie
      .split('; ')
      .find(row => row.startsWith('csrftoken='))
      ?.split('=')[1];

    if (!csrfCookie) {
      throw new Error('CSRF token missing');
    }

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
    } else {
      const error = await res.json().catch(() => ({}));
      throw new Error(error.error || 'Login failed');
    }
  };

  // ✅ Logout function — no redirect
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
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

// ✅ Custom hook
export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}