import { useLocation, useNavigate } from 'react-router-dom';
import { Home, Receipt, MapPin, MessageCircle, Download } from 'lucide-react';
import { cn } from '@/lib/utils';
import { usePWAInstall } from '@/hooks/usePWAInstall';
import { IOSInstallGuide } from '@/components/pwa/IOSInstallGuide';

export function AppBottomNav() {
  const location = useLocation();
  const navigate = useNavigate();
  const { canInstall, isIOS, promptInstall, showIOSInstructions, setShowIOSInstructions } = usePWAInstall();

  const navItems = [
    { icon: Home, label: 'Home', path: '/app/home' },
    { icon: Receipt, label: 'Boletos', path: '/app/boletos' },
    { icon: MessageCircle, label: 'Ajuda', path: '/app/chat' },
    { icon: MapPin, label: 'Rastreio', path: '/app/rastreamento' },
  ];

  const handleInstall = async () => {
    if (isIOS) {
      setShowIOSInstructions(true);
    } else {
      await promptInstall();
    }
  };

  return (
    <>
      <nav className="fixed bottom-0 left-0 right-0 z-50 flex items-center justify-around border-t bg-background pb-safe pt-2 md:hidden">
        {navItems.map((item) => {
          const isActive = location.pathname === item.path || 
            (item.path !== '/app/home' && location.pathname.startsWith(item.path));
          
          return (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              className={cn(
                'flex min-h-[44px] min-w-[56px] flex-col items-center justify-center gap-0.5 px-4 transition-colors',
                isActive ? 'text-primary' : 'text-muted-foreground'
              )}
            >
              <item.icon className="h-5 w-5" />
              <span className="text-[10px] font-medium">{item.label}</span>
            </button>
          );
        })}

        {/* Botão permanente de instalar PWA */}
        {canInstall && (
          <button
            onClick={handleInstall}
            className="flex min-h-[44px] min-w-[56px] flex-col items-center justify-center gap-0.5 px-4 transition-colors text-primary"
          >
            <div className="relative">
              <Download className="h-5 w-5" />
              <span className="absolute -top-1 -right-1 h-2 w-2 rounded-full bg-primary animate-pulse" />
            </div>
            <span className="text-[10px] font-medium">Instalar</span>
          </button>
        )}
      </nav>

      <IOSInstallGuide 
        open={showIOSInstructions} 
        onOpenChange={setShowIOSInstructions} 
      />
    </>
  );
}
