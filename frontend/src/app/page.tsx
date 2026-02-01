'use client';

import { useState, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import { Loader2, LogIn, Eye, EyeOff } from 'lucide-react';

// Validation rules
const USERNAME_PATTERN = /^[a-zA-Z0-9-]*$/;
const PASSWORD_PATTERN = /^[a-zA-Z0-9@!#]*$/;

export default function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [usernameError, setUsernameError] = useState('');
  const [passwordError, setPasswordError] = useState('');

  const { login } = useAuth();
  const router = useRouter();

  // Handle username input with sanitization
  const handleUsernameChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    let value = e.target.value;
    if (value === '') {
      setUsername('');
      setUsernameError('');
      return;
    }

    // If new char is invalid, reject entire change
    if (!USERNAME_PATTERN.test(value)) {
      // Keep previous valid state
      return;
    }

    setUsername(value);
    setUsernameError('');
  }, []);

  // Handle password input with sanitization
  const handlePasswordChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    let value = e.target.value;
    if (value === '') {
      setPassword('');
      setPasswordError('');
      return;
    }

    if (!PASSWORD_PATTERN.test(value)) {
      return; // block invalid input
    }

    setPassword(value);
    setPasswordError('');
  }, []);

  // Optional: validate on blur for extra clarity
  const handleUsernameBlur = () => {
    if (username && !USERNAME_PATTERN.test(username)) {
      setUsernameError('Only letters, digits, and hyphens (-) are allowed.');
    }
  };

  const handlePasswordBlur = () => {
    if (password && !PASSWORD_PATTERN.test(password)) {
      setPasswordError('Only letters, numbers, @, !, and # are allowed.');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // Final validation before submit
    if (!USERNAME_PATTERN.test(username)) {
      setError('Invalid username format.');
      return;
    }
    if (!PASSWORD_PATTERN.test(password)) {
      setError('Invalid password format.');
      return;
    }

    setSubmitting(true);
    try {
      await login(username, password);
      router.push('/dashboard');
    } catch (err: any) {
      setError(err.message || 'Invalid credentials. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#fdf5e6] p-4 font-sans">
      {/* Decorative background accent */}
      <div 
        className="absolute inset-0 -z-10 opacity-5"
        style={{
          backgroundImage: `radial-gradient(circle at 20% 30%, #cc5500 0%, transparent 40%), 
                             radial-gradient(circle at 80% 70%, #003c25 0%, transparent 40%)`,
        }}
      />

      <div className="w-full max-w-md">
        <div className="bg-white rounded-2xl shadow-xl p-8 border border-[#003c25]/10 backdrop-blur-sm">
          <div className="text-center mb-8">
            <div className="mx-auto w-16 h-16 rounded-2xl bg-[#003c25] flex items-center justify-center mb-4 shadow-lg animate-float">
              <LogIn className="text-[#fdf5e6] w-8 h-8" />
            </div>
            <h1 className="text-3xl font-bold text-[#003c25] tracking-tight">Dewlon Systems</h1>
            <p className="text-[#003c25]/70 mt-2 text-sm font-medium">Secure Portal Access</p>
          </div>

          {error && (
            <div className="mb-6 p-3.5 bg-red-50 text-red-700 rounded-xl text-sm border border-red-200 animate-fade-in">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Username */}
            <div>
              <label htmlFor="username" className="block text-sm font-semibold text-[#003c25] mb-2">
                Username
              </label>
              <input
                id="username"
                type="text"
                value={username}
                onChange={handleUsernameChange}
                onBlur={handleUsernameBlur}
                className={`w-full px-4 py-3.5 bg-[#fdf5e6] border rounded-xl focus:ring-2 focus:ring-[#cc5500] focus:border-transparent outline-none transition-all duration-200 placeholder:text-[#003c25]/40 ${
                  usernameError ? 'border-red-400' : 'border-[#003c25]/20'
                }`}
                placeholder="e.g. admin-01"
                required
                autoComplete="username"
              />
              {usernameError && (
                <p className="mt-1 text-sm text-red-600">{usernameError}</p>
              )}
            </div>

            {/* Password */}
            <div>
              <label htmlFor="password" className="block text-sm font-semibold text-[#003c25] mb-2">
                Password
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={handlePasswordChange}
                  onBlur={handlePasswordBlur}
                  className={`w-full px-4 py-3.5 bg-[#fdf5e6] border rounded-xl focus:ring-2 focus:ring-[#cc5500] focus:border-transparent outline-none transition-all duration-200 pr-12 placeholder:text-[#003c25]/40 ${
                    passwordError ? 'border-red-400' : 'border-[#003c25]/20'
                  }`}
                  placeholder="••••••••"
                  required
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#003c25]/50 hover:text-[#cc5500] transition-colors"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
              {passwordError && (
                <p className="mt-1 text-sm text-red-600">{passwordError}</p>
              )}
            </div>

            <button
              type="submit"
              disabled={submitting || !!usernameError || !!passwordError}
              className="w-full bg-[#003c25] hover:bg-[#002f1d] text-[#fdf5e6] font-semibold py-3.5 px-4 rounded-xl transition-all duration-200 transform hover:scale-[1.02] active:scale-[1.00] shadow-md hover:shadow-lg disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Signing in...
                </>
              ) : (
                <>
                  <LogIn className="w-5 h-5" />
                  Sign In Securely
                </>
              )}
            </button>
          </form>

          <div className="mt-8 pt-6 border-t border-[#003c25]/10 text-center">
            <p className="text-sm text-[#003c25]/60">
              © {new Date().getFullYear()} Dewlon Systems. All rights reserved.
            </p>
          </div>
        </div>

        <style jsx global>{`
          @keyframes float {
            0%, 100% { transform: translateY(0px); }
            50% { transform: translateY(-6px); }
          }
          .animate-float {
            animation: float 4s ease-in-out infinite;
          }
          .animate-fade-in {
            animation: fadeIn 0.3s ease-out;
          }
          @keyframes fadeIn {
            from { opacity: 0; transform: translateY(-4px); }
            to { opacity: 1; transform: translateY(0); }
          }
        `}</style>
      </div>
    </div>
  );
}