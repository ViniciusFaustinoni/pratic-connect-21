import { Users, UserPlus, Upload, Sparkles, Globe, Share2, UserCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface EntryIndicator {
  type: 'api' | 'distribuicao' | 'manual';
  label: string;
  count: number;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
}

interface LeadsHeaderProps {
  onNovoLead: () => void;
  onImport?: () => void;
  entryIndicators?: EntryIndicator[];
  onFilterByEntry?: (type: string) => void;
}

export function LeadsHeader({ 
  onNovoLead, 
  onImport, 
  entryIndicators,
  onFilterByEntry 
}: LeadsHeaderProps) {
  // Default indicators if not provided
  const defaultIndicators: EntryIndicator[] = entryIndicators || [];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className={cn(
            'flex h-14 w-14 items-center justify-center rounded-2xl',
            'bg-gradient-to-br from-primary/20 to-primary/5',
            'shadow-sm border border-primary/10'
          )}>
            <Users className="h-7 w-7 text-primary" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold tracking-tight">Leads</h1>
              <Sparkles className="h-4 w-4 text-primary/60" />
            </div>
            <p className="text-sm text-muted-foreground mt-0.5">
              Gerencie suas oportunidades de venda
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {onImport && (
            <Button 
              variant="outline" 
              onClick={onImport} 
              className="gap-2 border-border/50 hover:border-border hover:bg-muted/50"
            >
              <Upload className="h-4 w-4" />
              Importar
            </Button>
          )}
          <Button
            onClick={onNovoLead}
            className={cn(
              'gap-2',
              'bg-primary hover:bg-primary/90',
              'shadow-sm'
            )}
          >
            <UserPlus className="h-4 w-4" />
            Novo Lead
          </Button>
        </div>
      </div>

      {/* Entry Indicators */}
      {defaultIndicators.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-muted-foreground font-medium">Entradas:</span>
          {defaultIndicators.map((indicator) => (
            <Badge
              key={indicator.type}
              variant="outline"
              className={cn(
                'cursor-pointer transition-all hover:scale-105',
                indicator.color
              )}
              onClick={() => onFilterByEntry?.(indicator.type)}
            >
              <indicator.icon className="h-3 w-3 mr-1" />
              {indicator.label}: {indicator.count}
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}