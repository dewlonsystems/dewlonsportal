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
        {/* Sidebar is always rendered, but behaves differently on mobile vs desktop */}
        <Sidebar user={user} />

        {/* Main Content Area */}
        <div className="flex flex-col flex-1 lg:ml-64 w-full">
          {/* Sticky TopBar */}
          <div className="sticky top-0 z-10 bg-secondary">
            <TopBar user={user} />
          </div>

          {/* Page Content */}
          <main className="flex-1 p-4 lg:p-6">{children}</main>
        </div>
      </div>
    </SidebarProvider>
  );
}