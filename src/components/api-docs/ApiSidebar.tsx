import { cn } from '@/lib/utils';
import { apiEndpoints, apiGroups } from './apiEndpoints';

interface ApiSidebarProps {
  selectedEndpoint: string;
  onSelect: (id: string) => void;
}

const methodColors: Record<string, string> = {
  GET: 'text-emerald-500',
  POST: 'text-blue-500',
  PUT: 'text-amber-500',
  DELETE: 'text-red-500',
};

export function ApiSidebar({ selectedEndpoint, onSelect }: ApiSidebarProps) {
  return (
    <nav className="space-y-5">
      {apiGroups.map(group => (
        <div key={group}>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 px-2">
            {group}
          </p>
          <div className="space-y-0.5">
            {apiEndpoints
              .filter(e => e.group === group)
              .map(endpoint => (
                <button
                  key={endpoint.id}
                  onClick={() => onSelect(endpoint.id)}
                  className={cn(
                    'w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-sm transition-colors text-left',
                    selectedEndpoint === endpoint.id
                      ? 'bg-accent text-accent-foreground font-medium'
                      : 'text-muted-foreground hover:text-foreground hover:bg-accent/50'
                  )}
                >
                  <span className={cn('font-mono text-[10px] font-bold w-8 shrink-0', methodColors[endpoint.method])}>
                    {endpoint.method}
                  </span>
                  <span className="truncate">{endpoint.title}</span>
                </button>
              ))}
          </div>
        </div>
      ))}
    </nav>
  );
}
