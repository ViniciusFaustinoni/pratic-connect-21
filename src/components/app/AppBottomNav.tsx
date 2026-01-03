import { useLocation, useNavigate } from 'react-router-dom';
import { Home, Receipt, MapPin, User } from 'lucide-react';
import { cn } from '@/lib/utils';

const navItems = [
  { icon: Home, label: 'Home', path: '/app/home' },
  { icon: Receipt, label: 'Boletos', path: '/app/boletos' },
  { icon: MapPin, label: 'Rastreio', path: '/app/rastreamento' },
  { icon: User, label: 'Perfil', path: '/app/perfil' },
];

export function AppBottomNav() {
  const location = useLocation();
  const navigate = useNavigate();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 flex h-[56px] items-center justify-around border-t bg-background pb-safe md:hidden">
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
    </nav>
  );
}
