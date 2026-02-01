// src/lib/api.ts

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000';

export const api = {
  auth: {
    login: `${API_BASE}/api/auth/login/`,
    logout: `${API_BASE}/api/auth/logout/`,
    user: `${API_BASE}/api/auth/user/`,
  },
  transactions: {
    list: `${API_BASE}/api/transactions/`,
    initiate: `${API_BASE}/api/transactions/initiate/`,
    stats: `${API_BASE}/api/transactions/stats/`,
    detail: (id: number) => `${API_BASE}/api/transactions/${id}/`,
  },
};