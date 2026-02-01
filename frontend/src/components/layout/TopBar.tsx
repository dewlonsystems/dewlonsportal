// src/components/layout/TopBar.tsx
import { User } from '@/context/AuthContext';
import { LogOut } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';

interface TopBarProps {
  user: User;
}

export default function TopBar({ user }: TopBarProps) {
  const { logout } = useAuth();

  return (
    <div className="bg-white border-b border-primary/10 px-4 py-3 flex items-center justify-between">
      <div>
        <h1 className="text-xl font-bold text-primary">Portal Dashboard</h1>
      </div>
      
      <div className="flex items-center gap-4">
        <div className="text-right hidden sm:block">
          <p className="text-sm font-medium text-primary">{user.first_name || user.username}</p>
          <p className="text-xs text-primary/60">
            {user.is_superuser ? 'Administrator' : 'Staff'}
          </p>
        </div>
        <button
          onClick={logout}
          className="p-2 text-primary hover:bg-primary/10 rounded-full transition"
          aria-label="Logout"
        >
          <LogOut className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
}