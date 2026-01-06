import { Outlet } from 'react-router-dom';
import { SidebarProvider, SidebarInset } from '@/components/ui/sidebar';
import { AppSidebar } from './AppSidebar';
import { AppHeader } from './AppHeader';
import { AuthGuard } from '@/components/auth/AuthGuard';
import { SessionTimeoutProvider } from '@/components/auth/SessionTimeoutProvider';

export function AppLayout() {
  return (
    <AuthGuard>
      <SessionTimeoutProvider variant="internal">
        <SidebarProvider>
          <div className="flex min-h-screen w-full">
            <AppSidebar />
            <SidebarInset className="flex flex-1 flex-col">
              <AppHeader />
              <main className="flex-1 overflow-auto bg-muted/30 p-6">
                <Outlet />
              </main>
            </SidebarInset>
          </div>
        </SidebarProvider>
      </SessionTimeoutProvider>
    </AuthGuard>
  );
}
