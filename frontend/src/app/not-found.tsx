// src/app/not-found.tsx
'use client';

import { useRouter } from 'next/navigation';
import { ArrowLeft, Search } from 'lucide-react';
import { useEffect } from 'react';

export default function NotFound() {
  const router = useRouter();

  // Optional: auto-focus the button for accessibility
  useEffect(() => {
    const btn = document.getElementById('back-home-btn');
    if (btn) btn.focus();
  }, []);

  return (
    <div className="min-h-screen bg-secondary flex items-center justify-center p-4">
      <div className="max-w-md w-full text-center">
        {/* Decorative Icon */}
        <div className="relative inline-flex items-center justify-center w-20 h-20 mb-6 rounded-full bg-primary/10">
          <Search className="w-10 h-10 text-primary" />
          {/* Subtle animated ring */}
          <div className="absolute inset-0 rounded-full border-2 border-primary animate-ping opacity-20"></div>
        </div>

        {/* Status Code */}
        <h1 className="text-6xl font-bold text-primary mb-2">404</h1>

        {/* Title */}
        <h2 className="text-2xl font-semibold text-primary mb-3">Page Not Found</h2>

        {/* Description */}
        <p className="text-primary/70 mb-8 leading-relaxed">
          Sorry, we couldn’t find the page you’re looking for. It might have been moved or deleted.
        </p>

        {/* Action Button */}
        <button
          id="back-home-btn"
          onClick={() => router.push('/')}
          className="inline-flex items-center gap-2 px-6 py-3 bg-primary hover:bg-primary/90 text-secondary font-medium rounded-lg transition-all shadow-sm hover:shadow focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2 focus:ring-offset-secondary"
          aria-label="Go back to homepage"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Portal
        </button>

        {/* Footer note */}
        <p className="mt-10 text-sm text-primary/50">
          © {new Date().getFullYear()} Dewlon Systems
        </p>
      </div>
    </div>
  );
}