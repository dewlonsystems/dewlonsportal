// src/components/layout/Sidebar.tsx
import Link from 'next/link';
import { User } from '@/context/AuthContext';
import { 
  LayoutDashboard, 
  CreditCard, 
  FileText
} from 'lucide-react';
import { usePathname } from 'next/navigation';
import { useSidebar } from './SidebarContext';

interface SidebarProps {
  user: User;
}

export default function Sidebar({ user }: SidebarProps) {
  const pathname = usePathname();
  const { isSidebarOpen, closeSidebar } = useSidebar();

  const navItems = [
    { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
    { name: 'Payments', href: '/payments', icon: CreditCard },
    { name: 'Transactions', href: '/transactions', icon: FileText },
  ];

  const handleLinkClick = () => {
    if (window.innerWidth < 1024) { // lg breakpoint
      closeSidebar();
    }
  };

  return (
    <>
      {/* Overlay for mobile */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 z-20 bg-black/40 lg:hidden"
          onClick={closeSidebar}
        />
      )}

      {/* Sidebar */}
      <div
        className={`fixed lg:static z-30 w-64 h-screen bg-white border-r border-primary/10 transform transition-transform duration-300 ease-in-out ${
          isSidebarOpen ? 'translate-x-0' : '-translate-x-full'
        } lg:translate-x-0`}
      >
        <div className="p-4 border-b border-primary/10">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
              <LayoutDashboard className="w-5 h-5 text-secondary" />
            </div>
            <span className="font-bold text-primary">Portal</span>
          </div>
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
                    onClick={handleLinkClick}
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