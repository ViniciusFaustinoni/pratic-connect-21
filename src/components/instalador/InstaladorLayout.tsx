import { Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { InstaladorGuard } from './InstaladorGuard';
import { LogOut, Wrench } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function InstaladorLayout() {
  const { profile, signOut } = useAuth();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await signOut();
    navigate('/instalador/login');
  };

  return (
    <InstaladorGuard>
      <div className="flex min-h-screen flex-col bg-slate-900">
        {/* Header */}
        <header className="sticky top-0 z-50 border-b border-slate-700 bg-slate-800/95 backdrop-blur-sm">
          <div className="flex h-14 items-center justify-between px-4">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600">
                <Wrench className="h-4 w-4 text-white" />
              </div>
              <div>
                <span className="text-sm font-semibold text-white">PRATIC</span>
                <span className="ml-1 text-xs text-slate-400">Instalador</span>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-sm text-slate-300">{profile?.nome?.split(' ')[0]}</span>
              <Button
                variant="ghost"
                size="icon"
                onClick={handleSignOut}
                className="h-8 w-8 text-slate-400 hover:bg-slate-700 hover:text-white"
              >
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </header>

        {/* Content */}
        <main className="flex-1">
          <Outlet />
        </main>
      </div>
    </InstaladorGuard>
  );
}
