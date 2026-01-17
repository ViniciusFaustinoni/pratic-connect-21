import { Shield } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { AppMobileMenu } from './AppMobileMenu';
import { AppUserDropdown } from './AppUserDropdown';


const navItems = [
  { path: '/app/home', label: 'Início' },
  { path: '/app/boletos', label: 'Boletos' },
  { path: '/app/rastreamento', label: 'Mapa' },
  { path: '/app/assistencia', label: 'Assistência' },
];

export function AppHeader() {
  const navigate = useNavigate();

  return (
    <header className="sticky top-0 z-50 flex h-[60px] items-center justify-between bg-background px-4 shadow-sm">
      {/* Mobile: Menu hamburger | Desktop: Spacer */}
      <div className="flex w-10 md:hidden">
        <AppMobileMenu />
      </div>
      <div className="hidden w-10 md:block" />

      {/* Logo */}
      <button
        onClick={() => navigate('/app/home')}
        className="flex items-center gap-2"
      >
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
          <Shield className="h-4 w-4 text-primary-foreground" />
        </div>
        <span className="text-lg font-bold text-foreground">PRATIC</span>
      </button>

      {/* Desktop Navigation */}
      <nav className="hidden items-center gap-1 md:flex">
        {navItems.map((item) => (
          <Button
            key={item.path}
            variant="ghost"
            size="sm"
            onClick={() => navigate(item.path)}
            className={cn(
              'text-muted-foreground hover:text-foreground',
              location.pathname === item.path && 'bg-muted text-foreground'
            )}
          >
            {item.label}
          </Button>
        ))}
      </nav>

      {/* Actions */}
      <div className="flex items-center gap-2">
        {/* Desktop: User dropdown */}
        <div className="hidden md:block">
          <AppUserDropdown />
        </div>
      </div>
    </header>
  );
}
