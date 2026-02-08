import { Button } from '@/components/ui/button';
import { LayoutGrid, List, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';

export type ViewMode = 'cards' | 'table';

interface RastreadorListHeaderProps {
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
  totalCount: number;
  onNewRastreador: () => void;
}

export function RastreadorListHeader({
  viewMode,
  onViewModeChange,
  totalCount,
  onNewRastreador,
}: RastreadorListHeaderProps) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-3">
        <h2 className="text-lg font-semibold">
          Lista de Rastreadores
          <span className="ml-2 text-muted-foreground font-normal">({totalCount})</span>
        </h2>
      </div>

      <div className="flex items-center gap-2">
        {/* Toggle de visualização */}
        <div className="flex items-center rounded-lg border bg-muted/30 p-1">
          <Button
            variant="ghost"
            size="sm"
            className={cn(
              "h-8 px-3 gap-2",
              viewMode === 'table' && "bg-background shadow-sm"
            )}
            onClick={() => onViewModeChange('table')}
          >
            <List className="h-4 w-4" />
            <span className="hidden sm:inline">Tabela</span>
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className={cn(
              "h-8 px-3 gap-2",
              viewMode === 'cards' && "bg-background shadow-sm"
            )}
            onClick={() => onViewModeChange('cards')}
          >
            <LayoutGrid className="h-4 w-4" />
            <span className="hidden sm:inline">Cards</span>
          </Button>
        </div>

        <Button onClick={onNewRastreador} className="gap-2">
          <Plus className="h-4 w-4" />
          <span className="hidden sm:inline">Novo</span>
        </Button>
      </div>
    </div>
  );
}
