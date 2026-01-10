import { Outlet, useLocation, Navigate } from 'react-router-dom';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ConfiguracoesSidebar } from './components/ConfiguracoesSidebar';
import { ConfiguracoesMobileNav } from './components/ConfiguracoesMobileNav';
import { ConfiguracoesHeader } from './components/ConfiguracoesHeader';

export function ConfiguracoesLayout() {
  const location = useLocation();

  // Redirect to meu-perfil if accessing /configuracoes directly
  if (location.pathname === '/configuracoes') {
    return <Navigate to="/configuracoes/meu-perfil" replace />;
  }

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-background">
      {/* Header with breadcrumb and actions */}
      <ConfiguracoesHeader />

      {/* Mobile Navigation */}
      <ConfiguracoesMobileNav />

      {/* Main Content Area */}
      <div className="flex-1 flex min-h-0">
        <div className="w-full max-w-7xl mx-auto flex gap-8 p-4 sm:p-6 lg:p-8">
          {/* Desktop Sidebar */}
          <ConfiguracoesSidebar />

          {/* Content */}
          <main className="flex-1 min-w-0">
            <ScrollArea className="h-[calc(100vh-160px)]">
              <div className="pr-4 pb-8">
                <div className="animate-fade-in">
                  <Outlet />
                </div>
              </div>
            </ScrollArea>
          </main>
        </div>
      </div>
    </div>
  );
}
