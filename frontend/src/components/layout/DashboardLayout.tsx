// src/components/layout/DashboardLayout.tsx
'use client';

import { User } from '@/context/AuthContext';
import { SidebarProvider } from './SidebarContext';
import TopBar from './TopBar';
import Sidebar from './Sidebar';

export default function DashboardLayout({
  children,
  user,
}: {
  children: React.ReactNode;
  user: User;
}) {
  return (
    <SidebarProvider>
      <div className="flex min-h-screen bg-secondary">
        {/* Fixed Sidebar */}
        <Sidebar user={user} />
        
        {/* Main Content */}
        <div className="flex flex-col flex-1 lg:ml-64 ml-0 w-full">
          <div className="sticky top-0 z-10">
            <TopBar user={user} />
          </div>
          <main className="flex-1 overflow-auto p-4 lg:p-6 min-h-0">
            {children}
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}