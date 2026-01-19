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
      <div className="relative flex-1 max-w-md group">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground transition-colors group-focus-within:text-primary" />
        <Input
          placeholder="Buscar por nome ou telefone..."
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          className={cn(
            'pl-9 bg-card/80 border-border/50',
            'focus:border-primary/50 focus:ring-2 focus:ring-primary/20',
            'transition-all duration-200'
          )}
        />
      </div>

      {/* Quick Filters & Actions */}
      <div className="flex items-center gap-3 flex-wrap">

        {/* Separator */}
        <div className="hidden sm:block h-6 w-px bg-border/50" />

        {/* Advanced Filters Button */}
        <Button
          variant="outline"
          size="sm"
          onClick={onOpenFilters}
          className={cn(
            'gap-2 h-8 border-border/50 transition-all duration-200',
            filtersActive && 'border-primary/50 text-primary bg-primary/5'
          )}
        >
          <SlidersHorizontal className="h-4 w-4" />
          Filtros
          {filtersActive && (
            <span className="h-2 w-2 rounded-full bg-primary animate-pulse" />
          )}
        </Button>

        {/* View Mode Toggle */}
        <div className="flex items-center border border-border/50 rounded-lg p-1 bg-card/50 gap-0.5">
          <Toggle
            pressed={viewMode === 'kanban'}
            onPressedChange={() => onViewModeChange('kanban')}
            className={cn(
              'h-8 w-8 p-0 rounded-md transition-all duration-200',
              'data-[state=on]:bg-background data-[state=on]:shadow-sm'
            )}
            aria-label="Visualizar como kanban"
          >
            <LayoutGrid className="h-4 w-4" />
          </Toggle>
          <Toggle
            pressed={viewMode === 'list'}
            onPressedChange={() => onViewModeChange('list')}
            className={cn(
              'h-8 w-8 p-0 rounded-md transition-all duration-200',
              'data-[state=on]:bg-background data-[state=on]:shadow-sm'
            )}
            aria-label="Visualizar como lista"
          >
            <List className="h-4 w-4" />
          </Toggle>
        </div>
      </div>
    </div>
  );
}
