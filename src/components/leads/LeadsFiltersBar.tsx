import { Search, SlidersHorizontal, LayoutGrid, List, AlertCircle, Calendar } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Toggle } from '@/components/ui/toggle';
import { cn } from '@/lib/utils';

export type QuickFilter = 'all' | 'today' | 'overdue';

interface LeadsFiltersBarProps {
  search: string;
  onSearchChange: (value: string) => void;
  quickFilter: QuickFilter;
  onQuickFilterChange: (filter: QuickFilter) => void;
  overdueCount: number;
  viewMode: 'list' | 'kanban';
  onViewModeChange: (mode: 'list' | 'kanban') => void;
  onOpenFilters: () => void;
  filtersActive?: boolean;
}

export function LeadsFiltersBar({
  search,
  onSearchChange,
  quickFilter,
  onQuickFilterChange,
  overdueCount,
  viewMode,
  onViewModeChange,
  onOpenFilters,
  filtersActive = false,
}: LeadsFiltersBarProps) {
  return (
    <div className="flex flex-col sm:flex-row gap-4">
      {/* Search Input */}
      <div className="relative flex-1 max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar por nome ou telefone..."
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          className="pl-9 bg-card border-border"
        />
      </div>

      {/* Quick Filters & Actions */}
      <div className="flex items-center gap-2 flex-wrap">
        {/* Quick Filter Toggles */}
        <div className="flex items-center border rounded-lg bg-muted/30 p-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onQuickFilterChange('all')}
            className={cn(
              'h-8 px-3 text-sm',
              quickFilter === 'all' && 'bg-background shadow-sm'
            )}
          >
            Todos
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onQuickFilterChange('today')}
            className={cn(
              'h-8 px-3 text-sm gap-1.5',
              quickFilter === 'today' && 'bg-background shadow-sm'
            )}
          >
            <Calendar className="h-3.5 w-3.5" />
            Hoje
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onQuickFilterChange('overdue')}
            className={cn(
              'h-8 px-3 text-sm gap-1.5',
              quickFilter === 'overdue' && 'bg-background shadow-sm'
            )}
          >
            <AlertCircle className="h-3.5 w-3.5" />
            Atrasados
            {overdueCount > 0 && (
              <Badge
                variant="destructive"
                className="h-5 min-w-[20px] px-1.5 text-xs"
              >
                {overdueCount}
              </Badge>
            )}
          </Button>
        </div>

        {/* Advanced Filters Button */}
        <Button
          variant="outline"
          size="sm"
          onClick={onOpenFilters}
          className={cn(
            'gap-2 h-8',
            filtersActive && 'border-primary text-primary'
          )}
        >
          <SlidersHorizontal className="h-4 w-4" />
          Filtros
          {filtersActive && (
            <span className="h-2 w-2 rounded-full bg-primary" />
          )}
        </Button>

        {/* View Mode Toggle */}
        <div className="flex items-center border rounded-lg p-1 bg-muted/30">
          <Toggle
            pressed={viewMode === 'kanban'}
            onPressedChange={() => onViewModeChange('kanban')}
            className="h-8 w-8 p-0 data-[state=on]:bg-background data-[state=on]:shadow-sm"
            aria-label="Visualizar como kanban"
          >
            <LayoutGrid className="h-4 w-4" />
          </Toggle>
          <Toggle
            pressed={viewMode === 'list'}
            onPressedChange={() => onViewModeChange('list')}
            className="h-8 w-8 p-0 data-[state=on]:bg-background data-[state=on]:shadow-sm"
            aria-label="Visualizar como lista"
          >
            <List className="h-4 w-4" />
          </Toggle>
        </div>
      </div>
    </div>
  );
}
