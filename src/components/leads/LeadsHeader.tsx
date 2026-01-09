import { Users, UserPlus, Flame, Filter, List, LayoutGrid } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Toggle } from '@/components/ui/toggle';
import { cn } from '@/lib/utils';

interface LeadsHeaderProps {
  totalLeads: number;
  novosLeads: number;
  leadsQuentes: number;
  viewMode: 'list' | 'kanban';
  onViewModeChange: (mode: 'list' | 'kanban') => void;
  onNovoLead: () => void;
  onOpenFilters: () => void;
  filtersActive?: boolean;
}

export function LeadsHeader({
  totalLeads,
  novosLeads,
  leadsQuentes,
  viewMode,
  onViewModeChange,
  onNovoLead,
  onOpenFilters,
  filtersActive = false,
}: LeadsHeaderProps) {
  return (
    <div className="sticky top-0 z-10 bg-background border-b border-border px-6 py-4 space-y-4">
      {/* Título e Contadores */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
            <Users className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-semibold">Leads</h1>
            <p className="text-sm text-muted-foreground">Gestão de oportunidades</p>
          </div>
        </div>

        {/* Cards de Métricas */}
        <div className="flex gap-3">
          <Card className="px-4 py-2 flex items-center gap-3 min-w-[100px]">
            <Users className="h-4 w-4 text-muted-foreground" />
            <div>
              <p className="text-xs text-muted-foreground">Total</p>
              <p className="text-lg font-semibold">{totalLeads.toLocaleString('pt-BR')}</p>
            </div>
          </Card>
          <Card className="px-4 py-2 flex items-center gap-3 min-w-[100px]">
            <UserPlus className="h-4 w-4 text-blue-500" />
            <div>
              <p className="text-xs text-muted-foreground">Novos</p>
              <p className="text-lg font-semibold text-blue-500">{novosLeads}</p>
            </div>
          </Card>
          <Card className="px-4 py-2 flex items-center gap-3 min-w-[100px]">
            <Flame className="h-4 w-4 text-orange-500" />
            <div>
              <p className="text-xs text-muted-foreground">Quentes</p>
              <p className="text-lg font-semibold text-orange-500">{leadsQuentes}</p>
            </div>
          </Card>
        </div>
      </div>

      {/* Ações e Toggle */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <Button onClick={onNovoLead} className="gap-2">
            <UserPlus className="h-4 w-4" />
            Novo Lead
          </Button>
          <Button
            variant="outline"
            onClick={onOpenFilters}
            className={cn("gap-2", filtersActive && "border-primary text-primary")}
          >
            <Filter className="h-4 w-4" />
            Filtros
            {filtersActive && (
              <span className="ml-1 h-2 w-2 rounded-full bg-primary" />
            )}
          </Button>
        </div>

        {/* Toggle Lista/Kanban */}
        <div className="flex items-center border rounded-lg p-1 bg-muted/30">
          <Toggle
            pressed={viewMode === 'list'}
            onPressedChange={() => onViewModeChange('list')}
            className="gap-2 data-[state=on]:bg-background data-[state=on]:shadow-sm"
            aria-label="Visualizar como lista"
          >
            <List className="h-4 w-4" />
            <span className="hidden sm:inline">Lista</span>
          </Toggle>
          <Toggle
            pressed={viewMode === 'kanban'}
            onPressedChange={() => onViewModeChange('kanban')}
            className="gap-2 data-[state=on]:bg-background data-[state=on]:shadow-sm"
            aria-label="Visualizar como kanban"
          >
            <LayoutGrid className="h-4 w-4" />
            <span className="hidden sm:inline">Kanban</span>
          </Toggle>
        </div>
      </div>
    </div>
  );
}
