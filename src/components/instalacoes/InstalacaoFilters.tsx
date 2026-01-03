import { useState } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Search, Filter, CalendarIcon, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Calendar } from '@/components/ui/calendar';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { InstalacaoFilters as Filters, StatusInstalacao, PeriodoInstalacao } from '@/hooks/useInstalacoes';
import { useInstaladores } from '@/hooks/useInstalacoes';
import { STATUS_INSTALACAO_LABELS, PERIODO_LABELS, PeriodoInstalacao as PeriodoType } from '@/types/database';

interface InstalacaoFiltersProps {
  filters: Filters;
  onFiltersChange: (filters: Filters) => void;
}

const statusOptions = Object.entries(STATUS_INSTALACAO_LABELS) as [StatusInstalacao, string][];

export function InstalacaoFilters({ filters, onFiltersChange }: InstalacaoFiltersProps) {
  const [showFilters, setShowFilters] = useState(false);
  const { data: instaladores } = useInstaladores();

  const handleStatusToggle = (status: StatusInstalacao) => {
    const currentStatus = filters.status || [];
    const newStatus = currentStatus.includes(status)
      ? currentStatus.filter(s => s !== status)
      : [...currentStatus, status];
    
    onFiltersChange({ ...filters, status: newStatus.length > 0 ? newStatus : undefined });
  };

  const handleClearFilters = () => {
    onFiltersChange({});
  };

  const hasActiveFilters = 
    (filters.status && filters.status.length > 0) ||
    filters.periodo ||
    filters.dataInicio ||
    filters.dataFim ||
    filters.instaladorId ||
    filters.search;

  return (
    <div className="space-y-4">
      {/* Barra de busca e botão de filtros */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por associado ou placa..."
            value={filters.search || ''}
            onChange={(e) => onFiltersChange({ ...filters, search: e.target.value || undefined })}
            className="pl-9"
          />
        </div>
        <Button 
          variant={showFilters ? 'secondary' : 'outline'}
          onClick={() => setShowFilters(!showFilters)}
        >
          <Filter className="h-4 w-4 mr-2" />
          Filtros
          {hasActiveFilters && (
            <Badge variant="secondary" className="ml-2 h-5 px-1.5">
              {[
                filters.status?.length || 0,
                filters.periodo ? 1 : 0,
                filters.dataInicio || filters.dataFim ? 1 : 0,
                filters.instaladorId ? 1 : 0,
              ].reduce((a, b) => a + b, 0)}
            </Badge>
          )}
        </Button>
        {hasActiveFilters && (
          <Button variant="ghost" size="icon" onClick={handleClearFilters}>
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>

      {/* Painel de filtros expandido */}
      {showFilters && (
        <div className="p-4 border rounded-lg bg-card space-y-4">
          {/* Status */}
          <div>
            <label className="text-sm font-medium mb-2 block">Status</label>
            <div className="flex flex-wrap gap-2">
              {statusOptions.map(([value, label]) => (
                <Badge
                  key={value}
                  variant={filters.status?.includes(value) ? 'default' : 'outline'}
                  className="cursor-pointer"
                  onClick={() => handleStatusToggle(value)}
                >
                  {label}
                </Badge>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Período */}
            <div>
              <label className="text-sm font-medium mb-2 block">Período</label>
              <Select
                value={filters.periodo || ''}
                onValueChange={(value) => onFiltersChange({ 
                  ...filters, 
                  periodo: (value as PeriodoInstalacao) || undefined 
                })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Todos os períodos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Todos</SelectItem>
                  {Object.entries(PERIODO_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Data Início */}
            <div>
              <label className="text-sm font-medium mb-2 block">Data Início</label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      'w-full justify-start text-left font-normal',
                      !filters.dataInicio && 'text-muted-foreground'
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {filters.dataInicio 
                      ? format(filters.dataInicio, 'dd/MM/yyyy', { locale: ptBR })
                      : 'Selecione'
                    }
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={filters.dataInicio}
                    onSelect={(date) => onFiltersChange({ ...filters, dataInicio: date || undefined })}
                    initialFocus
                    className="pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
            </div>

            {/* Data Fim */}
            <div>
              <label className="text-sm font-medium mb-2 block">Data Fim</label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      'w-full justify-start text-left font-normal',
                      !filters.dataFim && 'text-muted-foreground'
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {filters.dataFim 
                      ? format(filters.dataFim, 'dd/MM/yyyy', { locale: ptBR })
                      : 'Selecione'
                    }
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={filters.dataFim}
                    onSelect={(date) => onFiltersChange({ ...filters, dataFim: date || undefined })}
                    initialFocus
                    className="pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>

          {/* Instalador */}
          <div>
            <label className="text-sm font-medium mb-2 block">Instalador</label>
            <Select
              value={filters.instaladorId || ''}
              onValueChange={(value) => onFiltersChange({ 
                ...filters, 
                instaladorId: value || undefined 
              })}
            >
              <SelectTrigger className="w-full md:w-[300px]">
                <SelectValue placeholder="Todos os instaladores" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">Todos</SelectItem>
                {instaladores?.map((i) => (
                  <SelectItem key={i.id} value={i.id}>
                    {i.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      )}
    </div>
  );
}
