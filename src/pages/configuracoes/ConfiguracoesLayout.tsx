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
    <div className="h-full bg-background overflow-hidden">
      <div className="max-w-6xl mx-auto flex h-full">
        {/* Sidebar Desktop */}
        <aside className="w-60 shrink-0 hidden lg:block border-r h-full overflow-y-auto">
          <div className="p-6 pt-8">
            <h1 className="text-lg font-semibold text-foreground mb-8">Configurações</h1>
            <ConfiguracoesSidebar />
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 min-w-0 h-full overflow-y-auto overscroll-contain">
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
