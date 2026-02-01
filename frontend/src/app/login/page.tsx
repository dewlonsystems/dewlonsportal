// src/app/login/page.tsx
'use client';

import { useState, useEffect } from 'react'; // ✅ Added useEffect
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import { Loader2, LogIn } from 'lucide-react';

export default function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const { login, user } = useAuth();
  const router = useRouter();

  // ✅ CORRECT: Redirect after render using useEffect
  useEffect(() => {
    if (user) {
      router.push('/dashboard');
    }
  }, [user, router]);

  // Show nothing while redirecting (prevents flash of login form)
  if (user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-secondary">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);

    try {
      await login(username, password);
      // ✅ No need to push here — useEffect will handle redirect when `user` updates
    } catch (err: any) {
      setError(err.message || 'Invalid credentials');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-secondary p-4">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-2xl shadow-xl p-8 border border-primary/10">
          <div className="text-center mb-8">
            <div className="mx-auto bg-primary w-16 h-16 rounded-full flex items-center justify-center mb-4">
              <LogIn className="text-secondary w-8 h-8" />
            </div>
            <h1 className="text-2xl font-bold text-primary">Portal Access</h1>
            <p className="text-primary/70 mt-2">Sign in to manage payments</p>
          </div>

          {error && (
            <div className="mb-6 p-3 bg-red-50 text-red-700 rounded-lg text-sm border border-red-200">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label htmlFor="username" className="block text-sm font-medium text-primary mb-2">
                Username
              </label>
              <input
                id="username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full px-4 py-3 bg-secondary border border-primary/20 rounded-lg focus:ring-2 focus:ring-accent focus:border-transparent outline-none transition"
                placeholder="Enter your username"
                required
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-primary mb-2">
                Password
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3 bg-secondary border border-primary/20 rounded-lg focus:ring-2 focus:ring-accent focus:border-transparent outline-none transition"
                placeholder="••••••••"
                required
              />
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full bg-primary hover:bg-primary/90 text-secondary font-semibold py-3 px-4 rounded-lg transition flex items-center justify-center gap-2 disabled:opacity-70"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Signing in...
                </>
              ) : (
                <>
                  <LogIn className="w-5 h-5" />
                  Sign In
                </>
              )}
            </button>
          </form>

          <div className="mt-8 pt-6 border-t border-primary/10 text-center">
            <p className="text-sm text-primary/60">
              © {new Date().getFullYear()} Portal. All rights reserved.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}