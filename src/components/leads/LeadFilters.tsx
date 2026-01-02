import { Search, Calendar, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { ETAPA_LABELS, ORIGEM_LABELS, type EtapaLead, type OrigemLead } from '@/types/database';
import { useVendedores } from '@/hooks/useVendedores';
import type { LeadFilters as LeadFiltersType } from '@/hooks/useLeads';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface LeadFiltersProps {
  filters: LeadFiltersType;
  onFiltersChange: (filters: LeadFiltersType) => void;
}

const etapas: EtapaLead[] = [
  'novo',
  'contato_inicial',
  'apresentacao',
  'cotacao_enviada',
  'negociacao',
  'ganho',
  'perdido',
];

const origens: OrigemLead[] = [
  'indicacao',
  'site',
  'facebook',
  'instagram',
  'google',
  'telefone',
  'presencial',
  'parceiro',
  'outro',
];

export function LeadFilters({ filters, onFiltersChange }: LeadFiltersProps) {
  const { data: vendedores } = useVendedores();

  const hasActiveFilters =
    (filters.etapa && filters.etapa !== 'all') ||
    (filters.origem && filters.origem !== 'all') ||
    (filters.vendedor_id && filters.vendedor_id !== 'all') ||
    filters.data_de ||
    filters.data_ate ||
    filters.search;

  const clearFilters = () => {
    onFiltersChange({
      etapa: 'all',
      origem: 'all',
      vendedor_id: 'all',
      data_de: undefined,
      data_ate: undefined,
      search: '',
    });
  };

  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:flex-wrap">
      {/* Busca */}
      <div className="relative flex-1 min-w-[200px]">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Buscar nome, telefone, placa, CPF..."
          className="pl-9"
          value={filters.search || ''}
          onChange={(e) => onFiltersChange({ ...filters, search: e.target.value })}
        />
      </div>

      {/* Etapa */}
      <Select
        value={filters.etapa || 'all'}
        onValueChange={(value) => onFiltersChange({ ...filters, etapa: value as EtapaLead | 'all' })}
      >
        <SelectTrigger className="w-full sm:w-40">
          <SelectValue placeholder="Etapa" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todas etapas</SelectItem>
          {etapas.map((etapa) => (
            <SelectItem key={etapa} value={etapa}>
              {ETAPA_LABELS[etapa]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Origem */}
      <Select
        value={filters.origem || 'all'}
        onValueChange={(value) => onFiltersChange({ ...filters, origem: value as OrigemLead | 'all' })}
      >
        <SelectTrigger className="w-full sm:w-40">
          <SelectValue placeholder="Origem" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todas origens</SelectItem>
          {origens.map((origem) => (
            <SelectItem key={origem} value={origem}>
              {ORIGEM_LABELS[origem]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Vendedor */}
      <Select
        value={filters.vendedor_id || 'all'}
        onValueChange={(value) => onFiltersChange({ ...filters, vendedor_id: value })}
      >
        <SelectTrigger className="w-full sm:w-44">
          <SelectValue placeholder="Vendedor" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todos vendedores</SelectItem>
          {vendedores?.map((vendedor) => (
            <SelectItem key={vendedor.user_id} value={vendedor.user_id}>
              {vendedor.nome}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Data De */}
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" className="w-full sm:w-36 justify-start">
            <Calendar className="mr-2 h-4 w-4" />
            {filters.data_de ? format(new Date(filters.data_de), 'dd/MM/yy') : 'Data de'}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <CalendarComponent
            mode="single"
            selected={filters.data_de ? new Date(filters.data_de) : undefined}
            onSelect={(date) =>
              onFiltersChange({
                ...filters,
                data_de: date ? format(date, 'yyyy-MM-dd') : undefined,
              })
            }
            locale={ptBR}
            initialFocus
          />
        </PopoverContent>
      </Popover>

      {/* Data Até */}
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" className="w-full sm:w-36 justify-start">
            <Calendar className="mr-2 h-4 w-4" />
            {filters.data_ate ? format(new Date(filters.data_ate), 'dd/MM/yy') : 'Data até'}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <CalendarComponent
            mode="single"
            selected={filters.data_ate ? new Date(filters.data_ate) : undefined}
            onSelect={(date) =>
              onFiltersChange({
                ...filters,
                data_ate: date ? format(date, 'yyyy-MM-dd') : undefined,
              })
            }
            locale={ptBR}
            initialFocus
          />
        </PopoverContent>
      </Popover>

      {/* Limpar Filtros */}
      {hasActiveFilters && (
        <Button variant="ghost" size="sm" onClick={clearFilters} className="gap-1">
          <X className="h-4 w-4" />
          Limpar
        </Button>
      )}
    </div>
  );
}
