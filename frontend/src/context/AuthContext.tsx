// src/context/AuthContext.tsx
'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';

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
  loading: boolean; // true only during initial session restoration
}

// ✅ Create context
const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true); // only true on initial client-side load

  // 🔁 Always attempt to restore session on app mount (client-only)
  useEffect(() => {
    const fetchUser = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/auth/user/`, {
          credentials: 'include', // ← sends Django session cookie
        });

        if (res.ok) {
          const userData = await res.json();
          setUser(userData);
        }
        // If not authenticated, leave user as null — that's expected
      } catch (err) {
        console.error('Failed to fetch user session:', err);
      } finally {
        setLoading(false); // ← critical: always resolve loading state
      }
    };

    fetchUser();
  }, []); // Run once when component mounts on client

  // ✅ Login function — establishes session via Django
  const login = async (username: string, password: string) => {
    // Ensure we have a CSRF token by fetching any endpoint that sets it
    await fetch(`${API_BASE}/api/auth/user/`, { credentials: 'include' });

    // Extract CSRF token from cookie
    const csrfToken = document.cookie
      .split('; ')
      .find((row) => row.startsWith('csrftoken='))
      ?.split('=')[1];

    if (!csrfToken) {
      throw new Error('CSRF token missing. Please refresh and try again.');
    }

    const res = await fetch(`${API_BASE}/api/auth/login/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRFToken': csrfToken,
      },
      credentials: 'include', // ← includes session cookie
      body: JSON.stringify({ username, password }),
    });

    if (res.ok) {
      const userData = await res.json();
      setUser(userData);
    } else {
      const errorData = await res.json().catch(() => ({}));
      throw new Error(errorData.error || 'Login failed. Please check your credentials.');
    }
  };

  // ✅ Logout function — clears session on backend and frontend
  const logout = async () => {
    const csrfToken = document.cookie
      .split('; ')
      .find((row) => row.startsWith('csrftoken='))
      ?.split('=')[1];

    await fetch(`${API_BASE}/api/auth/logout/`, {
      method: 'POST',
      headers: {
        'X-CSRFToken': csrfToken || '',
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

// ✅ Custom hook for easy access
export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}