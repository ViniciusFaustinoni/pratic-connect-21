import { Outlet, useLocation, Navigate } from 'react-router-dom';
import { ConfiguracoesSidebar } from './components/ConfiguracoesSidebar';
import { ConfiguracoesMobileNav } from './components/ConfiguracoesMobileNav';

export function ConfiguracoesLayout() {
  const location = useLocation();

  // Redirect to meu-perfil if accessing /configuracoes directly
  if (location.pathname === '/configuracoes') {
    return <Navigate to="/configuracoes/meu-perfil" replace />;
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-6xl mx-auto flex">
        {/* Sidebar Desktop */}
        <aside className="w-60 shrink-0 hidden lg:block border-r min-h-screen">
          <div className="sticky top-0 p-6 pt-8">
            <h1 className="text-lg font-semibold text-foreground mb-8">Configurações</h1>
            <ConfiguracoesSidebar />
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 min-w-0">
          {/* Mobile Navigation */}
          <ConfiguracoesMobileNav />
          
          {/* Content */}
          <div className="p-6 lg:p-8">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
