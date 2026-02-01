// src/components/layout/TopBar.tsx
import { User } from '@/context/AuthContext';
import { LogOut, Menu } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useSidebar } from './SidebarContext'; // We'll create this

interface TopBarProps {
  user: User;
}

export default function TopBar({ user }: TopBarProps) {
  const { logout } = useAuth();
  const { toggleSidebar } = useSidebar();

  return (
    <div className="bg-white border-b border-primary/10 px-4 py-3 flex items-center justify-between">
      {/* Hamburger for mobile */}
      <button
        onClick={toggleSidebar}
        className="lg:hidden p-2 text-primary hover:bg-primary/10 rounded"
        aria-label="Toggle menu"
      >
        <Menu className="w-5 h-5" />
      </button>

      {/* Logo / Title */}
      <div className="lg:hidden absolute left-1/2 transform -translate-x-1/2">
        <h1 className="text-xl font-bold text-primary">Portal</h1>
      </div>
      <div className="hidden lg:block">
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