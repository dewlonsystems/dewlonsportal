// src/app/dashboard/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { Loader2, TrendingUp } from 'lucide-react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend
} from 'recharts';
import DashboardLayout from '@/components/layout/DashboardLayout';

interface StatData {
  total_collected: string;
  period_start: string;
  period_end: string;
  trend: [string, string][];
}

export default function DashboardPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [stats, setStats] = useState<StatData | null>(null);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState<'day' | 'week' | 'month' | 'custom'>('month');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');

  // Safe redirect
  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
    }
  }, [user, authLoading, router]);

  const fetchStats = async (start?: string, end?: string) => {
    setLoading(true);
    try {
      let url = api.transactions.stats;
      if (start && end) {
        const params = new URLSearchParams({ start, end });
        url += `?${params.toString()}`;
      }

      const res = await fetch(url, { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setStats(data);
      }
    } catch (err) {
      console.error('Failed to fetch stats:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!user) return;

    const now = new Date();
    let start, end;

    switch (dateRange) {
      case 'day':
        start = now.toISOString().split('T')[0];
        end = start;
        break;
      case 'week': {
        const day = now.getDay();
        const diff = now.getDate() - day + (day === 0 ? -6 : 1);
        const monday = new Date(now.setDate(diff));
        start = monday.toISOString().split('T')[0];
        end = new Date().toISOString().split('T')[0];
        break;
      }
      case 'month':
        start = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
        end = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];
        break;
      case 'custom':
        if (customStart && customEnd) {
          start = customStart;
          end = customEnd;
        } else {
          start = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
          end = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];
        }
        break;
      default:
        start = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
        end = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];
    }

    if (start && end) {
      fetchStats(start, end);
    }
  }, [user, dateRange, customStart, customEnd]);

  const handleCustomSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (customStart && customEnd && customStart <= customEnd) {
      setDateRange('custom');
    }
  };

  if (authLoading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-secondary">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  const chartData = stats?.trend.map(([date, amount]) => ({
    date,
    amount: parseFloat(amount),
  })) || [];

  return (
    <DashboardLayout user={user}>
      <div className="p-4 lg:p-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-primary">Dashboard</h1>
          <p className="text-primary/70">
            {user.is_superuser ? 'Overview of all transactions' : 'Your payment performance'}
          </p>
        </div>

        {/* Total Collected Banner */}
        {stats && (
          <div className="bg-white rounded-xl shadow-sm border border-primary/10 p-4 mb-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-primary/70">Total Collected</p>
                <p className="text-2xl font-bold text-accent">KES {stats.total_collected}</p>
              </div>
              <div className="bg-accent/10 p-3 rounded-lg">
                <TrendingUp className="w-6 h-6 text-accent" />
              </div>
            </div>
          </div>
        )}

        {/* Date Range Controls */}
        <div className="bg-white rounded-xl shadow-sm border border-primary/10 p-4 mb-6">
          <div className="flex flex-wrap gap-2">
            {(['day', 'week', 'month'] as const).map((range) => (
              <button
                key={range}
                onClick={() => setDateRange(range)}
                className={`px-3 py-2 text-sm font-medium rounded-lg transition ${
                  dateRange === range
                    ? 'bg-primary text-secondary'
                    : 'bg-secondary text-primary hover:bg-primary/5'
                }`}
              >
                {range.charAt(0).toUpperCase() + range.slice(1)}
              </button>
            ))}

            <form onSubmit={handleCustomSubmit} className="flex flex-wrap gap-2 flex-1 min-w-[240px]">
              <input
                type="date"
                value={customStart}
                onChange={(e) => setCustomStart(e.target.value)}
                className="px-2.5 py-2 text-sm bg-secondary border border-primary/20 rounded-lg"
                max={new Date().toISOString().split('T')[0]}
              />
              <span className="self-center text-primary/70 hidden sm:inline text-sm">to</span>
              <input
                type="date"
                value={customEnd}
                onChange={(e) => setCustomEnd(e.target.value)}
                className="px-2.5 py-2 text-sm bg-secondary border border-primary/20 rounded-lg"
                min={customStart}
                max={new Date().toISOString().split('T')[0]}
              />
              <button
                type="submit"
                className="px-3 py-2 bg-primary text-secondary text-sm font-medium rounded-lg hover:bg-primary/90 transition"
              >
                Apply
              </button>
            </form>
          </div>
        </div>

        {/* Chart — Mobile-Optimized Height */}
        <div className="bg-white rounded-xl shadow-sm border border-primary/10 p-4">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="w-5 h-5 text-primary" />
            <h2 className="text-lg font-semibold text-primary">Payment Trend</h2>
          </div>

          <div className="h-[280px] sm:h-[320px] w-full">
            {loading ? (
              <div className="w-full h-full flex items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
              </div>
            ) : chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis 
                    dataKey="date" 
                    tick={{ fill: '#003c25', fontSize: 11 }}
                    tickFormatter={(date) => {
                      const d = new Date(date);
                      return d.toLocaleDateString('en-KE', { day: 'numeric', month: 'short' });
                    }}
                  />
                  <YAxis 
                    tick={{ fill: '#003c25', fontSize: 11 }}
                    tickFormatter={(value) => `KES ${value}`}
                  />
                  <Tooltip
                    formatter={(value) => [`KES ${value}`, 'Amount']}
                    labelFormatter={(label) => new Date(label).toLocaleDateString('en-KE')}
                    contentStyle={{
                      backgroundColor: '#fdf5e6',
                      borderColor: '#003c25',
                      borderRadius: '8px',
                      boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
                    }}
                  />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="amount"
                    name="Collected Amount"
                    stroke="#cc5500"
                    strokeWidth={3}
                    dot={{ stroke: '#cc5500', strokeWidth: 2, r: 3 }}
                    activeDot={{ r: 5, stroke: '#003c25' }}
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="w-full h-full flex items-center justify-center text-primary/60 text-sm">
                No data available for selected period
              </div>
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}