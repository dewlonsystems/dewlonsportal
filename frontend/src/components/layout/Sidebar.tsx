// src/components/layout/Sidebar.tsx
import Link from 'next/link';
import { User } from '@/context/AuthContext';
import { 
  LayoutDashboard, 
  CreditCard, 
  FileText,
  ChevronLeft
} from 'lucide-react';
import { usePathname } from 'next/navigation';

interface SidebarProps {
  user: User;
  isOpen: boolean;
  toggle: () => void;
}

export default function Sidebar({ user, isOpen, toggle }: SidebarProps) {
  const pathname = usePathname();

  const navItems = [
    { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
    { name: 'Payments', href: '/payments', icon: CreditCard },
    { name: 'Transactions', href: '/transactions', icon: FileText },
  ];

  return (
    <>
      {/* Overlay for mobile */}
      {isOpen && (
        <div 
          className="fixed inset-0 z-20 bg-black/40 lg:hidden"
          onClick={toggle}
        />
      )}

      {/* ✅ ALWAYS FIXED — no lg:static, always fixed */}
      <div
        className={`fixed z-30 w-64 h-screen bg-white border-r border-primary/10 transform transition-transform duration-300 ease-in-out ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        } lg:translate-x-0`}
      >
        <div className="p-4 border-b border-primary/10 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
              <LayoutDashboard className="w-5 h-5 text-secondary" />
            </div>
            <span className="font-bold text-primary">Portal</span>
          </div>
          <button
            onClick={toggle}
            className="lg:hidden p-1 text-primary hover:bg-primary/10 rounded"
            aria-label="Close menu"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
        </div>

        <nav className="p-4 h-[calc(100vh-73px)] overflow-y-auto">
          <ul className="space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href;
              
              return (
                <li key={item.name}>
                  <Link
                    href={item.href}
                    className={`flex items-center gap-3 w-full px-3 py-2.5 rounded-lg transition ${
                      isActive
                        ? 'bg-primary text-secondary'
                        : 'text-primary hover:bg-primary/5'
                    }`}
                  >
                    <Icon className="w-5 h-5" />
                    <span>{item.name}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      </div>
    </>
  );
}