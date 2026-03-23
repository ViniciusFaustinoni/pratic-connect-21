import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { SessionTimeoutProvider } from '@/components/auth/SessionTimeoutProvider';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { LogOut, Building2, CreditCard, LayoutDashboard } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';

export function AgenciaLayout() {
  const { profile } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/auth', { replace: true });
  };

  return (
    <ProtectedRoute allowedTipos={['agencia']} authRedirect="/auth">
      <SessionTimeoutProvider variant="internal">
        <div className="flex min-h-screen flex-col bg-background">
          {/* Header */}
          <header className="sticky top-0 z-50 border-b bg-card px-4 py-3">
            <div className="mx-auto flex max-w-screen-xl items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
                  <Building2 className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <h1 className="text-sm font-semibold text-foreground">Painel da Agência</h1>
                  <p className="text-xs text-muted-foreground">{profile?.nome || 'Agência'}</p>
                </div>
              </div>
              <Button variant="ghost" size="sm" onClick={handleLogout} className="gap-2">
                <LogOut className="h-4 w-4" />
                <span className="hidden sm:inline">Sair</span>
              </Button>
            </div>
          </header>

          {/* Content */}
          <main className="flex-1 overflow-y-auto">
            <div className="mx-auto max-w-screen-xl px-4 py-6">
              <Outlet />
            </div>
          </main>
        </div>
      </SessionTimeoutProvider>
    </ProtectedRoute>
  );
}
