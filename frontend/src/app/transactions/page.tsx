// src/app/transactions/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { Loader2, CreditCard, Smartphone, AlertCircle, CheckCircle, Clock, AlertTriangle } from 'lucide-react';
import DashboardLayout from '@/components/layout/DashboardLayout'; // ✅ IMPORT LAYOUT

interface Transaction {
  id: number;
  amount: string;
  payment_method: string;
  status: string;
  initiated_by: string;
  created_at: string;
  customer_identifier: string;
}

export default function TransactionsPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalCollected, setTotalCollected] = useState<string>('0.00');

  // ✅ Safe redirect using useEffect
  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/');
    }
  }, [user, authLoading, router]);

  // Fetch transactions and total
  useEffect(() => {
    if (!user) return;

    const fetchTransactions = async () => {
      try {
        const res = await fetch(api.transactions.list, {
          credentials: 'include',
        });

        if (res.ok) {
          const data = await res.json();
          setTransactions(data);

          const total = data
            .filter((t: Transaction) => t.status === 'Completed')
            .reduce((sum: number, t: Transaction) => sum + parseFloat(t.amount), 0);
          setTotalCollected(total.toFixed(2));
        }
      } catch (err) {
        console.error('Failed to fetch transactions:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchTransactions();
  }, [user]);

  if (authLoading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-secondary">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  const getStatusBadge = (status: string) => {
    const baseClasses = "inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium";
    
    switch (status) {
      case 'Completed':
        return (
          <span className={`${baseClasses} bg-green-100 text-green-800`}>
            <CheckCircle className="w-3 h-3" />
            Completed
          </span>
        );
      case 'Failed':
        return (
          <span className={`${baseClasses} bg-red-100 text-red-800`}>
            <AlertCircle className="w-3 h-3" />
            Failed
          </span>
        );
      case 'Processing':
        return (
          <span className={`${baseClasses} bg-blue-100 text-blue-800`}>
            <Clock className="w-3 h-3" />
            Processing
          </span>
        );
      case 'Pending':
        return (
          <span className={`${baseClasses} bg-yellow-100 text-yellow-800`}>
            <AlertTriangle className="w-3 h-3" />
            Pending
          </span>
        );
      default:
        return <span className={`${baseClasses} bg-gray-100 text-gray-800`}>{status}</span>;
    }
  };

  const getMethodIcon = (method: string) => {
    if (method.includes('MPesa') || method.includes('STK')) {
      return <Smartphone className="w-4 h-4 text-primary" />;
    }
    return <CreditCard className="w-4 h-4 text-primary" />;
  };

  const formatDate = (isoString: string) => {
    return new Date(isoString).toLocaleString('en-KE', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // ✅ WRAP ENTIRE PAGE CONTENT IN DASHBOARD LAYOUT
  return (
    <DashboardLayout user={user}>
      <div className="p-4 lg:p-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-primary">Transactions</h1>
          <p className="text-primary/70">
            {user.is_superuser ? 'All payment records' : 'Your payment activity'}
          </ p>
        </div>

        {/* Total Collected Banner */}
        <div className="bg-white rounded-xl shadow-sm border border-primary/10 p-4 mb-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-primary/70">Total Collected</p>
              <p className="text-2xl font-bold text-accent">KES {totalCollected}</p>
            </div>
            <div className="bg-accent/10 p-3 rounded-lg">
              <CreditCard className="w-6 h-6 text-accent" />
            </div>
          </div>
        </div>

        {/* Transactions Table */}
        {loading ? (
          <div className="bg-white rounded-xl shadow-sm border border-primary/10 p-8 flex items-center justify-center">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        ) : transactions.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm border border-primary/10 p-8 text-center">
            <CreditCard className="w-12 h-12 text-primary/30 mx-auto mb-4" />
            <p className="text-primary/70">No transactions yet</p>
          </div>
        ) : (
          <div className="bg-white rounded-xl shadow-sm border border-primary/10 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-primary/5">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-primary uppercase tracking-wider">ID</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-primary uppercase tracking-wider">Amount</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-primary uppercase tracking-wider">Method</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-primary uppercase tracking-wider">Status</th>
                    {user.is_superuser && (
                      <th className="px-4 py-3 text-left text-xs font-semibold text-primary uppercase tracking-wider">Initiated By</th>
                    )}
                    <th className="px-4 py-3 text-left text-xs font-semibold text-primary uppercase tracking-wider">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-primary/10">
                  {transactions.map((txn) => (
                    <tr key={txn.id} className="hover:bg-primary/2">
                      <td className="px-4 py-3 text-sm text-primary/80">#{txn.id}</td>
                      <td className="px-4 py-3 text-sm font-medium text-primary">KES {txn.amount}</td>
                      <td className="px-4 py-3 text-sm">
                        <div className="flex items-center gap-2">
                          {getMethodIcon(txn.payment_method)}
                          <span>{txn.payment_method}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">{getStatusBadge(txn.status)}</td>
                      {user.is_superuser && (
                        <td className="px-4 py-3 text-sm text-primary">{txn.initiated_by}</td>
                      )}
                      <td className="px-4 py-3 text-sm text-primary/80">{formatDate(txn.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}