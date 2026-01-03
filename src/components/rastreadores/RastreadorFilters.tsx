import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Search, X } from 'lucide-react';
import { usePlataformas, type RastreadorFilters as Filters, type StatusRastreador } from '@/hooks/useRastreadores';
import { STATUS_RASTREADOR_LABELS, PLATAFORMA_RASTREADOR_LABELS } from '@/types/database';

interface RastreadorFiltersProps {
  filters: Filters;
  onFiltersChange: (filters: Filters) => void;
}

export function RastreadorFilters({ filters, onFiltersChange }: RastreadorFiltersProps) {
  const { data: plataformas } = usePlataformas();

  const handleStatusChange = (value: string) => {
    if (value === 'todos') {
      onFiltersChange({ ...filters, status: undefined });
    } else {
      onFiltersChange({ ...filters, status: [value as StatusRastreador] });
    }
  };

  const handlePlataformaChange = (value: string) => {
    if (value === 'todas') {
      onFiltersChange({ ...filters, plataforma: undefined });
    } else {
      onFiltersChange({ ...filters, plataforma: value });
    }
  };

  const handleComunicacaoChange = (value: string) => {
    onFiltersChange({ 
      ...filters, 
      comunicacao: value as 'online' | 'offline' | 'todos' 
    });
  };

  const handleSearchChange = (value: string) => {
    onFiltersChange({ ...filters, search: value || undefined });
  };

  const clearFilters = () => {
    onFiltersChange({});
  };

  const hasFilters = filters.status || filters.plataforma || filters.comunicacao || filters.search;

  return (
    <div className="flex flex-col gap-4 md:flex-row md:items-center">
      <div className="relative flex-1">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Buscar por código, série, IMEI..."
          value={filters.search || ''}
          onChange={(e) => handleSearchChange(e.target.value)}
          className="pl-9"
        />
      </div>

      <div className="flex flex-wrap gap-2">
        <Select
          value={filters.status?.[0] || 'todos'}
          onValueChange={handleStatusChange}
        >
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos Status</SelectItem>
            {Object.entries(STATUS_RASTREADOR_LABELS).map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={filters.plataforma || 'todas'}
          onValueChange={handlePlataformaChange}
        >
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="Plataforma" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todas">Todas Plataformas</SelectItem>
            {plataformas?.map((plat) => (
              <SelectItem key={plat} value={plat}>
                {PLATAFORMA_RASTREADOR_LABELS[plat] || plat}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={filters.comunicacao || 'todos'}
          onValueChange={handleComunicacaoChange}
        >
          <SelectTrigger className="w-[130px]">
            <SelectValue placeholder="Comunicação" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos</SelectItem>
            <SelectItem value="online">Online</SelectItem>
            <SelectItem value="offline">Offline</SelectItem>
          </SelectContent>
        </Select>

        {hasFilters && (
          <Button variant="ghost" size="icon" onClick={clearFilters}>
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  );
}
