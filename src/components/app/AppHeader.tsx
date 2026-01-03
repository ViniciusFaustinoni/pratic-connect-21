import { Bell, Shield } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

interface AppHeaderProps {
  notificationCount?: number;
  onNotificationClick?: () => void;
}

export function AppHeader({ notificationCount = 0, onNotificationClick }: AppHeaderProps) {
  return (
    <header className="sticky top-0 z-50 flex h-[60px] items-center justify-between bg-white px-4 shadow-sm">
      {/* Spacer for balance */}
      <div className="w-10" />
      
      {/* Centered Logo */}
      <div className="flex items-center gap-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
          <Shield className="h-4 w-4 text-primary-foreground" />
        </div>
        <span className="text-lg font-bold text-foreground">PRATIC</span>
      </div>

      {/* Notifications */}
      <Button
        variant="ghost"
        size="icon"
        className="relative min-h-[44px] min-w-[44px]"
        onClick={onNotificationClick}
      >
        <Bell className="h-5 w-5" />
        {notificationCount > 0 && (
          <Badge 
            variant="destructive" 
            className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center p-0 text-xs"
          >
            {notificationCount > 9 ? '9+' : notificationCount}
          </Badge>
        )}
      </Button>
    </header>
  );
}
