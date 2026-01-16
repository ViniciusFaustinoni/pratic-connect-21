import { RefreshCw } from 'lucide-react';

interface SyncStatusIndicatorProps {
  isChecking?: boolean;
}

export function SyncStatusIndicator({ isChecking = true }: SyncStatusIndicatorProps) {
  return (
    <div className="fixed bottom-4 right-4 bg-background/80 backdrop-blur-sm border px-3 py-2 rounded-full shadow-lg flex items-center gap-2 text-xs text-muted-foreground z-50">
      <RefreshCw className={`h-3 w-3 ${isChecking ? 'animate-spin' : ''}`} />
      <span>Sincronizando automaticamente...</span>
    </div>
  );
}
