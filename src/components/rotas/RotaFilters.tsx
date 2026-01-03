import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { CalendarIcon, Search, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
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
import { 
  useInstaladores, 
  useCidadesComInstalacoes,
  STATUS_ROTA_LABELS,
  type RotaFilters as RotaFiltersType,
  type StatusRota 
} from '@/hooks/useRotas';

interface RotaFiltersProps {
  filters: RotaFiltersType;
  onFiltersChange: (filters: RotaFiltersType) => void;
}

export function RotaFilters({ filters, onFiltersChange }: RotaFiltersProps) {
  const { data: instaladores } = useInstaladores();
  const { data: cidades } = useCidadesComInstalacoes();

  const updateFilter = <K extends keyof RotaFiltersType>(
    key: K, 
    value: RotaFiltersType[K]
  ) => {
    onFiltersChange({ ...filters, [key]: value });
  };

  const clearFilters = () => {
    onFiltersChange({});
  };

  const hasFilters = Object.values(filters).some(v => v !== undefined && v !== '');

  return (
    <div className="flex flex-wrap items-center gap-3">
      {/* Busca */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Buscar código..."
          value={filters.search || ''}
          onChange={(e) => updateFilter('search', e.target.value)}
          className="w-[180px] pl-9"
        />
      </div>

      {/* Data Início */}
      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            className={cn(
              'w-[140px] justify-start text-left font-normal',
              !filters.dataInicio && 'text-muted-foreground'
            )}
          >
            <CalendarIcon className="mr-2 h-4 w-4" />
            {filters.dataInicio ? (
              format(filters.dataInicio, 'dd/MM/yyyy')
            ) : (
              <span>Data início</span>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single"
            selected={filters.dataInicio}
            onSelect={(date) => updateFilter('dataInicio', date)}
            initialFocus
            className="pointer-events-auto"
          />
        </PopoverContent>
      </Popover>

      {/* Data Fim */}
      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            className={cn(
              'w-[140px] justify-start text-left font-normal',
              !filters.dataFim && 'text-muted-foreground'
            )}
          >
            <CalendarIcon className="mr-2 h-4 w-4" />
            {filters.dataFim ? (
              format(filters.dataFim, 'dd/MM/yyyy')
            ) : (
              <span>Data fim</span>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single"
            selected={filters.dataFim}
            onSelect={(date) => updateFilter('dataFim', date)}
            initialFocus
            className="pointer-events-auto"
          />
        </PopoverContent>
      </Popover>

      {/* Status */}
      <Select
        value={filters.status?.[0] || 'all'}
        onValueChange={(value) => 
          updateFilter('status', value === 'all' ? undefined : [value as StatusRota])
        }
      >
        <SelectTrigger className="w-[150px]">
          <SelectValue placeholder="Status" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todos os status</SelectItem>
          {Object.entries(STATUS_ROTA_LABELS).map(([value, label]) => (
            <SelectItem key={value} value={value}>
              {label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Instalador */}
      <Select
        value={filters.instaladorId || 'all'}
        onValueChange={(value) => 
          updateFilter('instaladorId', value === 'all' ? undefined : value)
        }
      >
        <SelectTrigger className="w-[180px]">
          <SelectValue placeholder="Instalador" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todos os instaladores</SelectItem>
          {instaladores?.map((inst) => (
            <SelectItem key={inst.id} value={inst.id}>
              {inst.nome}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Cidade */}
      <Select
        value={filters.cidade || 'all'}
        onValueChange={(value) => 
          updateFilter('cidade', value === 'all' ? undefined : value)
        }
      >
        <SelectTrigger className="w-[150px]">
          <SelectValue placeholder="Cidade" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todas as cidades</SelectItem>
          {cidades?.map((cidade) => (
            <SelectItem key={cidade} value={cidade}>
              {cidade}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Limpar filtros */}
      {hasFilters && (
        <Button variant="ghost" size="sm" onClick={clearFilters}>
          <X className="mr-2 h-4 w-4" />
          Limpar
        </Button>
      )}
    </div>
  );
}
