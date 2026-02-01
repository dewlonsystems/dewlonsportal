// src/app/payments/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import { Loader2, Smartphone, CreditCard, ArrowLeft, CheckCircle } from 'lucide-react';
import { api } from '@/lib/api';
import DashboardLayout from '@/components/layout/DashboardLayout'; // ✅ IMPORT LAYOUT

type PaymentMethod = 'STK_PUSH' | 'PAYSTACK';

export default function PaymentsPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  // ✅ Safe redirect using useEffect
  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/');
    }
  }, [user, authLoading, router]);

  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('STK_PUSH');
  const [amount, setAmount] = useState<string>('');
  const [identifier, setIdentifier] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<{ message: string; checkoutUrl?: string } | null>(null);

  const isMpesa = paymentMethod === 'STK_PUSH';

  const validateInputs = () => {
    setError(null);
    
    const amountNum = parseFloat(amount);
    if (!amount || isNaN(amountNum) || amountNum <= 0) {
      setError('Please enter a valid amount');
      return false;
    }

    if (isMpesa) {
      const phoneRegex = /^(\+?254|0)?[17]\d{8}$/;
      if (!phoneRegex.test(identifier.replace(/\s/g, ''))) {
        setError('Please enter a valid Kenyan phone number (e.g., 0712345678)');
        return false;
      }
    } else {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(identifier)) {
        setError('Please enter a valid email address');
        return false;
      }
    }

    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateInputs()) return;

    setIsSubmitting(true);
    setError(null);
    setSuccess(null);

    try {
      await fetch(api.auth.user, { credentials: 'include' });
      const csrfCookie = document.cookie
        .split('; ')
        .find(row => row.startsWith('csrftoken='))?.split('=')[1];

      if (!csrfCookie) throw new Error('CSRF token missing');

      const res = await fetch(api.transactions.initiate, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRFToken': csrfCookie,
        },
        credentials: 'include',
        body: JSON.stringify({
          payment_method: paymentMethod,
          amount: parseFloat(amount),
          customer_identifier: identifier.replace(/\s/g, ''),
        }),
      });

      const data = await res.json();

      if (res.ok) {
        if (paymentMethod === 'PAYSTACK' && data.checkout_url) {
          window.location.href = data.checkout_url;
        } else {
          setSuccess({
            message: 'Payment request sent! Please check your phone to complete.',
          });
          setTimeout(() => {
            setAmount('');
            setIdentifier('');
            setSuccess(null);
          }, 3000);
        }
      } else {
        setError(data.error || 'Failed to initiate payment. Please try again.');
      }
    } catch (err: any) {
      console.error('Payment error:', err);
      setError('Network error. Please check your connection.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (authLoading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-secondary">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  // ✅ WRAP ENTIRE PAGE CONTENT IN DASHBOARD LAYOUT
  return (
    <DashboardLayout user={user}>
      <div className="p-4 lg:p-6 max-w-2xl mx-auto">
        <div className="mb-6">
          <button
            onClick={() => router.back()}
            className="flex items-center gap-2 text-primary hover:text-accent transition mb-4"
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </button>
          <h1 className="text-2xl font-bold text-primary">Initiate Payment</h1>
          <p className="text-primary/70">Collect payment via MPesa or card</p>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-primary/10 p-6">
          {/* Method Toggle */}
          <div className="flex gap-2 mb-6">
            <button
              type="button"
              onClick={() => setPaymentMethod('STK_PUSH')}
              className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-lg transition ${
                isMpesa
                  ? 'bg-primary text-secondary'
                  : 'bg-secondary text-primary hover:bg-primary/5'
              }`}
            >
              <Smartphone className="w-5 h-5" />
              MPesa (STK Push)
            </button>
            <button
              type="button"
              onClick={() => setPaymentMethod('PAYSTACK')}
              className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-lg transition ${
                !isMpesa
                  ? 'bg-primary text-secondary'
                  : 'bg-secondary text-primary hover:bg-primary/5'
              }`}
            >
              <CreditCard className="w-5 h-5" />
              Paystack (Card/Bank)
            </button>
          </div>

          {/* Success Message */}
          {success && (
            <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg flex items-start gap-3">
              <CheckCircle className="w-5 h-5 text-green-600 mt-0.5" />
              <div>
                <p className="text-green-800 font-medium">{success.message}</p>
              </div>
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
              {error}
            </div>
          )}

          {/* Payment Form */}
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label htmlFor="amount" className="block text-sm font-medium text-primary mb-2">
                Amount (KES)
              </label>
              <input
                id="amount"
                type="number"
                min="1"
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-full px-4 py-3 bg-secondary border border-primary/20 rounded-lg focus:ring-2 focus:ring-accent focus:border-transparent outline-none transition"
                placeholder="e.g., 500"
                required
              />
            </div>

            <div>
              <label htmlFor="identifier" className="block text-sm font-medium text-primary mb-2">
                {isMpesa ? 'Phone Number' : 'Email Address'}
              </label>
              <input
                id="identifier"
                type={isMpesa ? 'tel' : 'email'}
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                className="w-full px-4 py-3 bg-secondary border border-primary/20 rounded-lg focus:ring-2 focus:ring-accent focus:border-transparent outline-none transition"
                placeholder={isMpesa ? '0712345678' : 'customer@example.com'}
                required
              />
              <p className="mt-1 text-xs text-primary/60">
                {isMpesa
                  ? 'Enter a valid Kenyan mobile number'
                  : 'Customer will receive payment link via email'}
              </p>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full bg-primary hover:bg-primary/90 text-secondary font-semibold py-3 px-4 rounded-lg transition flex items-center justify-center gap-2 disabled:opacity-70"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  {isMpesa ? 'Send STK Push' : 'Create Payment Link'}
                </>
              )}
            </button>
          </form>
        </div>
      </div>
    </DashboardLayout>
  );
}