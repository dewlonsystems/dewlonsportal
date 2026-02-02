// src/app/payments/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Loader2,
  Smartphone,
  CreditCard,
  ArrowLeft,
  CheckCircle,
  XCircle,
  RotateCcw,
} from 'lucide-react';
import { api } from '@/lib/api';
import DashboardLayout from '@/components/layout/DashboardLayout';

type PaymentMethod = 'STK_PUSH' | 'PAYSTACK';
type TransactionStatus = 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';

interface TransactionResponse {
  id: number;
  status: TransactionStatus;
  amount: string;
  payment_method: string;
  customer_identifier: string;
}

const getCSRFToken = (): string | null => {
  if (typeof document === 'undefined') return null;
  return (
    document.cookie
      .split('; ')
      .find((row) => row.startsWith('csrftoken='))
      ?.split('=')[1] || null
  );
};

export default function PaymentsPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();

  // 🔐 Auth guard — only runs after initial auth state is resolved
  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/');
    }
  }, [user, authLoading, router]);

  // Form state
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('STK_PUSH');
  const [amount, setAmount] = useState<string>('');
  const [identifier, setIdentifier] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Polling & modal state
  const [activeTransactionId, setActiveTransactionId] = useState<number | null>(null);
  const [pollingStatus, setPollingStatus] = useState<TransactionStatus | null>(null);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [showFailure, setShowFailure] = useState(false);

  const isMpesa = paymentMethod === 'STK_PUSH';

  // 🔁 POLLING FOR MPESA OR ACTIVE TRANSACTION
  useEffect(() => {
    if (!activeTransactionId) return;

    const pollStatus = async () => {
      try {
        const res = await fetch(`/api/transactions/${activeTransactionId}/`, {
          credentials: 'include',
        });

        if (!res.ok) {
          console.error('Failed to fetch transaction status');
          return;
        }

        const transactionData: TransactionResponse = await res.json();
        setPollingStatus(transactionData.status);

        if (transactionData.status === 'COMPLETED') {
          setShowConfirmation(true);
          setActiveTransactionId(null);
        } else if (['FAILED', 'CANCELLED'].includes(transactionData.status)) {
          setShowFailure(true);
          setActiveTransactionId(null);
        }
      } catch (err) {
        console.error('Polling error:', err);
      }
    };

    pollStatus();
    const interval = setInterval(pollStatus, 3000);
    return () => clearInterval(interval);
  }, [activeTransactionId]);

  // ✅ HANDLE PAYSTACK RETURN (using searchParams — safe and modern)
  useEffect(() => {
    const reference = searchParams.get('reference');
    if (!reference || typeof window === 'undefined') return;

    // Clear query params immediately after reading
    router.replace('/payments', { scroll: false });

    // Start verification flow
    setPollingStatus('PROCESSING');
    setError(null);
    setSuccessMessage(null);

    const verifyPayment = async () => {
      const checkStatus = async (): Promise<boolean> => {
        try {
          const res = await fetch(`/api/transactions/paystack/verify/${reference}/`, {
            credentials: 'include',
          });

          if (!res.ok) {
            return false;
          }

          const data = await res.json();
          if (data.status === 'COMPLETED') {
            setShowConfirmation(true);
            return true;
          } else if (['FAILED', 'CANCELLED'].includes(data.status)) {
            setShowFailure(true);
            return true;
          }
          return false;
        } catch (err) {
          console.error('Verification check failed:', err);
          return false;
        }
      };

      let attempts = 0;
      const maxAttempts = 6;
      const poll = async () => {
        const done = await checkStatus();
        if (!done && attempts < maxAttempts) {
          attempts++;
          setTimeout(poll, 2000);
        } else if (!done) {
          setError(
            'Payment verification is taking longer than expected. You’ll receive a confirmation email once complete.'
          );
          setPollingStatus(null);
        }
      };

      poll();
    };

    verifyPayment();
  }, [searchParams, router]); // ← Now depends on searchParams (correct for Next.js App Router)

  const validateInputs = () => {
    setError(null);

    const amountNum = parseFloat(amount);
    if (!amount || isNaN(amountNum) || amountNum <= 0) {
      setError('Please enter a valid amount');
      return false;
    }

    if (isMpesa) {
      if (!/^0[17]\d{8}$/.test(identifier)) {
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
    setSuccessMessage(null);

    try {
      const csrfToken = getCSRFToken();
      if (!csrfToken) {
        throw new Error('CSRF token missing. Please refresh the page.');
      }

      const res = await fetch(api.transactions.initiate, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRFToken': csrfToken,
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
          window.location.href = data.checkout_url; // Full redirect to Paystack
        } else if (data.id) {
          setActiveTransactionId(data.id);
          setSuccessMessage('Payment request sent! Please check your phone to complete.');
          setAmount('');
          setIdentifier('');
          setTimeout(() => setSuccessMessage(null), 4000);
        }
      } else {
        setError(data.error || 'Failed to initiate payment. Please try again.');
      }
    } catch (err: any) {
      console.error('Payment error:', err);
      setError(err.message || 'Network error. Please check your connection.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetFlow = () => {
    setShowConfirmation(false);
    setShowFailure(false);
    router.push('/dashboard');
  };

  // Show loader while auth is resolving
  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#fdf5e6]">
        <Loader2 className="w-8 h-8 animate-spin text-[#003c25]" />
      </div>
    );
  }

  // Redirect if not authenticated (after loading is done)
  if (!user) {
    router.push('/');
    return null;
  }

  return (
    <DashboardLayout user={user}>
      {/* Confirmation Modal */}
      {showConfirmation && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-3xl p-8 max-w-sm w-full text-center shadow-2xl border border-[#003c25]/10 animate-pop-in">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-5">
              <CheckCircle className="w-10 h-10 text-green-600" />
            </div>
            <h2 className="text-2xl font-bold text-[#003c25] mb-2">Payment Confirmed!</h2>
            <p className="text-[#003c25]/80 mb-6">
              Thank you! Your payment has been successfully processed.
            </p>
            <button
              onClick={resetFlow}
              className="w-full bg-[#003c25] hover:bg-[#002f1d] text-[#fdf5e6] font-semibold py-3 px-4 rounded-xl transition transform hover:scale-[1.02]"
            >
              Go to Dashboard
            </button>
          </div>
        </div>
      )}

      {/* Failure Modal */}
      {showFailure && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-3xl p-8 max-w-sm w-full text-center shadow-2xl border border-red-200 animate-pop-in">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-5">
              <XCircle className="w-10 h-10 text-red-600" />
            </div>
            <h2 className="text-2xl font-bold text-[#003c25] mb-2">Payment Failed</h2>
            <p className="text-[#003c25]/80 mb-6">
              The payment was not completed. Please try again or contact support.
            </p>
            <button
              onClick={resetFlow}
              className="w-full bg-[#cc5500] hover:bg-[#b84a00] text-[#fdf5e6] font-semibold py-3 px-4 rounded-xl transition flex items-center justify-center gap-2"
            >
              <RotateCcw className="w-4 h-4" />
              Try Again
            </button>
          </div>
        </div>
      )}

      <div className="p-4 lg:p-6 max-w-2xl mx-auto">
        <div className="mb-6">
          <button
            onClick={() => router.back()}
            className="flex items-center gap-2 text-[#003c25] hover:text-[#cc5500] transition mb-4"
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </button>
          <h1 className="text-2xl font-bold text-[#003c25]">Initiate Payment</h1>
          <p className="text-[#003c25]/70">Collect payment via MPesa or card securely</p>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-[#003c25]/10 p-6">
          {/* Method Toggle */}
          <div className="flex gap-2 mb-6">
            <button
              type="button"
              onClick={() => setPaymentMethod('STK_PUSH')}
              disabled={!!activeTransactionId || pollingStatus === 'PROCESSING'}
              className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl transition ${
                isMpesa
                  ? 'bg-[#003c25] text-[#fdf5e6]'
                  : 'bg-[#fdf5e6] text-[#003c25] hover:bg-[#003c25]/5'
              } ${activeTransactionId || pollingStatus === 'PROCESSING' ? 'opacity-60 cursor-not-allowed' : ''}`}
            >
              <Smartphone className="w-5 h-5" />
              MPesa (STK Push)
            </button>
            <button
              type="button"
              onClick={() => setPaymentMethod('PAYSTACK')}
              disabled={!!activeTransactionId || pollingStatus === 'PROCESSING'}
              className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl transition ${
                !isMpesa
                  ? 'bg-[#003c25] text-[#fdf5e6]'
                  : 'bg-[#fdf5e6] text-[#003c25] hover:bg-[#003c25]/5'
              } ${activeTransactionId || pollingStatus === 'PROCESSING' ? 'opacity-60 cursor-not-allowed' : ''}`}
            >
              <CreditCard className="w-5 h-5" />
              Paystack (Card/Bank)
            </button>
          </div>

          {/* Verification Status Banner (for Paystack return) */}
          {pollingStatus === 'PROCESSING' && (
            <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-xl flex items-center gap-3 animate-fade-in">
              <Loader2 className="w-5 h-5 animate-spin text-blue-600" />
              <span className="text-blue-800">Verifying your payment...</span>
            </div>
          )}

          {/* Success Banner */}
          {successMessage && (
            <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-xl flex items-start gap-3 animate-fade-in">
              <CheckCircle className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
              <p className="text-green-800">{successMessage}</p>
            </div>
          )}

          {/* Error Banner */}
          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 animate-fade-in">
              {error}
            </div>
          )}

          {/* Polling Status Indicator (for MPesa) */}
          {activeTransactionId && pollingStatus !== 'PROCESSING' && (
            <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-xl flex items-center gap-3 animate-fade-in">
              <Loader2 className="w-5 h-5 animate-spin text-blue-600" />
              <span className="text-blue-800">
                Awaiting payment confirmation...
                <br />
                <span className="text-xs text-blue-600">Do not close this page</span>
              </span>
            </div>
          )}

          {/* Payment Form */}
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label htmlFor="amount" className="block text-sm font-medium text-[#003c25] mb-2">
                Amount (KES)
              </label>
              <input
                id="amount"
                type="number"
                min="1"
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                disabled={isSubmitting || !!activeTransactionId || pollingStatus === 'PROCESSING'}
                className="w-full px-4 py-3.5 bg-[#fdf5e6] border border-[#003c25]/20 rounded-xl focus:ring-2 focus:ring-[#cc5500] focus:border-transparent outline-none transition"
                placeholder="e.g., 500"
                required
              />
            </div>

            <div>
              <label htmlFor="identifier" className="block text-sm font-medium text-[#003c25] mb-2">
                {isMpesa ? 'Phone Number' : 'Email Address'}
              </label>
              <input
                id="identifier"
                type={isMpesa ? 'tel' : 'email'}
                inputMode={isMpesa ? 'numeric' : undefined}
                value={identifier}
                onChange={(e) => {
                  let value = e.target.value;
                  if (isMpesa) {
                    value = value.replace(/\D/g, '').slice(0, 10);
                  }
                  setIdentifier(value);
                }}
                disabled={isSubmitting || !!activeTransactionId || pollingStatus === 'PROCESSING'}
                className="w-full px-4 py-3.5 bg-[#fdf5e6] border border-[#003c25]/20 rounded-xl focus:ring-2 focus:ring-[#cc5500] focus:border-transparent outline-none transition"
                placeholder={isMpesa ? '0712345678' : 'customer@example.com'}
                required
                pattern={isMpesa ? '0[17][0-9]{8}' : undefined}
                title={isMpesa ? 'Enter a 10-digit Kenyan number starting with 07 or 01' : undefined}
              />
              <p className="mt-1.5 text-xs text-[#003c25]/60">
                {isMpesa
                  ? 'Enter a 10-digit number starting with 07 or 01 (e.g., 0712345678)'
                  : 'Customer will receive a secure payment link'}
              </p>
            </div>

            <button
              type="submit"
              disabled={isSubmitting || !!activeTransactionId || pollingStatus === 'PROCESSING'}
              className="w-full bg-[#003c25] hover:bg-[#002f1d] text-[#fdf5e6] font-semibold py-3.5 px-4 rounded-xl transition flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed transform hover:scale-[1.02] active:scale-[1.00]"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Processing...
                </>
              ) : isMpesa ? (
                'Send STK Push'
              ) : (
                'Create Payment Link'
              )}
            </button>
          </form>
        </div>
      </div>

      <style jsx global>{`
        @keyframes pop-in {
          0% { opacity: 0; transform: scale(0.9); }
          100% { opacity: 1; transform: scale(1); }
        }
        @keyframes fade-in {
          from { opacity: 0; transform: translateY(-4px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-pop-in {
          animation: pop-in 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards;
        }
        .animate-fade-in {
          animation: fade-in 0.3s ease-out;
        }
      `}</style>
    </DashboardLayout>
  );
}