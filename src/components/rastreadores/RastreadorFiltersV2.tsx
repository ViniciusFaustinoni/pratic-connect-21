import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Search, X, Filter } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { type RastreadorFilters as Filters, type StatusRastreador } from '@/hooks/useRastreadores';
import { usePlataformasOptions } from '@/hooks/usePlataformasCRUD';

interface RastreadorFiltersV2Props {
  filters: Filters;
  onFiltersChange: (filters: Filters) => void;
}

const STATUS_OPTIONS: { value: StatusRastreador | 'todos'; label: string; color: string }[] = [
  { value: 'todos', label: 'Todos', color: 'bg-muted text-muted-foreground' },
  { value: 'estoque', label: 'Estoque', color: 'bg-green-500/20 text-green-700 hover:bg-green-500/30' },
  { value: 'instalado', label: 'Instalado', color: 'bg-emerald-500/20 text-emerald-700 hover:bg-emerald-500/30' },
  { value: 'manutencao', label: 'Manutenção', color: 'bg-orange-500/20 text-orange-700 hover:bg-orange-500/30' },
  { value: 'baixado', label: 'Baixado', color: 'bg-gray-500/20 text-gray-600 hover:bg-gray-500/30' },
];

const COMUNICACAO_OPTIONS: { value: 'todos' | 'online' | 'offline'; label: string; color: string }[] = [
  { value: 'todos', label: 'Todos', color: 'bg-muted text-muted-foreground' },
  { value: 'online', label: 'Online', color: 'bg-emerald-500/20 text-emerald-700 hover:bg-emerald-500/30' },
  { value: 'offline', label: 'Offline', color: 'bg-red-500/20 text-red-700 hover:bg-red-500/30' },
];

export function RastreadorFiltersV2({ filters, onFiltersChange }: RastreadorFiltersV2Props) {
  const { data: plataformas, isLoading: loadingPlataformas } = usePlataformasOptions();
  const [isExpanded, setIsExpanded] = useState(false);

  const handleStatusChange = (value: StatusRastreador | 'todos') => {
    if (value === 'todos') {
      onFiltersChange({ ...filters, status: undefined });
    } else {
      onFiltersChange({ ...filters, status: [value] });
    }
  };

  const handleComunicacaoChange = (value: 'todos' | 'online' | 'offline') => {
    onFiltersChange({ 
      ...filters, 
      comunicacao: value === 'todos' ? undefined : value 
    });
  };

  const handlePlataformaChange = (value: string) => {
    if (value === 'todas') {
      onFiltersChange({ ...filters, plataforma: undefined });
    } else {
      onFiltersChange({ ...filters, plataforma: value });
    }
  };

  const handleSearchChange = (value: string) => {
    onFiltersChange({ ...filters, search: value || undefined });
  };

  const clearFilters = () => {
    onFiltersChange({});
  };

  const currentStatus = filters.status?.[0] || 'todos';
  const currentComunicacao = filters.comunicacao || 'todos';
  
  const activeFiltersCount = [
    filters.status,
    filters.plataforma,
    filters.comunicacao && filters.comunicacao !== 'todos',
    filters.search,
  ].filter(Boolean).length;

  return (
    <div className="space-y-4">
      {/* Linha 1: Busca */}
      <div className="flex gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar por IMEI, código, placa ou nome do associado..."
            value={filters.search || ''}
            onChange={(e) => handleSearchChange(e.target.value)}
            className="pl-9 h-11"
          />
        </div>
        
        <Button
          variant={isExpanded ? 'secondary' : 'outline'}
          size="lg"
          className="gap-2 h-11"
          onClick={() => setIsExpanded(!isExpanded)}
        >
          <Filter className="h-4 w-4" />
          Filtros
          {activeFiltersCount > 0 && (
            <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-xs bg-primary text-primary-foreground">
              {activeFiltersCount}
            </Badge>
          )}
        </Button>

        {activeFiltersCount > 0 && (
          <Button variant="ghost" size="lg" className="h-11 gap-2" onClick={clearFilters}>
            <X className="h-4 w-4" />
            Limpar
          </Button>
        )}
      </div>

      {/* Linha 2: Filtros expandidos */}
      {isExpanded && (
        <div className="space-y-4 p-4 rounded-lg border bg-card animate-in fade-in-0 slide-in-from-top-2 duration-200">
          {/* Status - Chips toggle */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-muted-foreground">Status</label>
            <div className="flex flex-wrap gap-2">
              {STATUS_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  onClick={() => handleStatusChange(option.value)}
                  className={cn(
                    "px-3 py-1.5 rounded-full text-sm font-medium transition-all",
                    currentStatus === option.value
                      ? cn(option.color, "ring-2 ring-offset-2 ring-offset-background ring-primary/50")
                      : "bg-muted/50 text-muted-foreground hover:bg-muted"
                  )}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          {/* Comunicação - Chips toggle */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-muted-foreground">Comunicação</label>
            <div className="flex flex-wrap gap-2">
              {COMUNICACAO_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  onClick={() => handleComunicacaoChange(option.value)}
                  className={cn(
                    "px-3 py-1.5 rounded-full text-sm font-medium transition-all",
                    currentComunicacao === option.value
                      ? cn(option.color, "ring-2 ring-offset-2 ring-offset-background ring-primary/50")
                      : "bg-muted/50 text-muted-foreground hover:bg-muted"
                  )}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          {/* Plataforma - Select */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-muted-foreground">Plataforma</label>
            <Select
              value={filters.plataforma || 'todas'}
              onValueChange={handlePlataformaChange}
              disabled={loadingPlataformas}
            >
              <SelectTrigger className="w-[220px]">
                <SelectValue placeholder="Todas Plataformas" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todas">Todas Plataformas</SelectItem>
                {plataformas?.map((plat) => (
                  <SelectItem key={plat.codigo} value={plat.codigo}>
                    {plat.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      )}

      {/* Indicadores de filtros ativos (quando não expandido) */}
      {!isExpanded && activeFiltersCount > 0 && (
        <div className="flex flex-wrap gap-2">
          {filters.status && (
            <Badge variant="secondary" className="gap-1">
              Status: {STATUS_OPTIONS.find(s => s.value === filters.status?.[0])?.label}
              <button onClick={() => handleStatusChange('todos')} className="ml-1 hover:text-destructive">
                <X className="h-3 w-3" />
              </button>
            </Badge>
          )}
          {filters.comunicacao && filters.comunicacao !== 'todos' && (
            <Badge variant="secondary" className="gap-1">
              {filters.comunicacao === 'online' ? 'Online' : 'Offline'}
              <button onClick={() => handleComunicacaoChange('todos')} className="ml-1 hover:text-destructive">
                <X className="h-3 w-3" />
              </button>
            </Badge>
          )}
          {filters.plataforma && (
            <Badge variant="secondary" className="gap-1">
              {plataformas?.find(p => p.codigo === filters.plataforma)?.nome || filters.plataforma}
              <button onClick={() => handlePlataformaChange('todas')} className="ml-1 hover:text-destructive">
                <X className="h-3 w-3" />
              </button>
            </Badge>
          )}
        </div>
      )}
    </div>
  );
}
