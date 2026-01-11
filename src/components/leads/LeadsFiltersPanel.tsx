import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { DatePickerWithRange } from '@/components/ui/date-range-picker';
import { ETAPA_LABELS, ORIGEM_LABELS, type EtapaLead } from '@/types/database';
import type { DateRange } from 'react-day-picker';

interface Vendedor {
  id: string;
  user_id: string;
  nome: string;
}

interface LeadsFiltersPanelProps {
  open: boolean;
  onClose: () => void;
  filters: {
    search: string;
    etapa: string;
    origem: string;
    vendedor: string;
    dateRange: DateRange | undefined;
  };
  onFiltersChange: (filters: LeadsFiltersPanelProps['filters']) => void;
  vendedores: Vendedor[];
}

const ETAPAS: EtapaLead[] = [
  'novo',
  'contato',
  'qualificado',
  'cotacao_enviada',
  'negociacao',
  'ganho',
  'perdido',
];

export function LeadsFiltersPanel({
  open,
  onClose,
  filters,
  onFiltersChange,
  vendedores,
}: LeadsFiltersPanelProps) {
  const handleReset = () => {
    onFiltersChange({
      search: '',
      etapa: '',
      origem: '',
      vendedor: '',
      dateRange: undefined,
    });
  };

  const hasActiveFilters =
    filters.search ||
    filters.etapa ||
    filters.origem ||
    filters.vendedor ||
    filters.dateRange;

  return (
    <Sheet open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <SheetContent className="w-[320px] sm:w-[380px]">
        <SheetHeader>
          <SheetTitle className="flex items-center justify-between">
            Filtros
            {hasActiveFilters && (
              <Button variant="ghost" size="sm" onClick={handleReset}>
                <X className="h-4 w-4 mr-1" />
                Limpar
              </Button>
            )}
          </SheetTitle>
        </SheetHeader>

        <div className="space-y-6 mt-6">
          {/* Search */}
          <div className="space-y-2">
            <Label>Buscar</Label>
            <Input
              placeholder="Nome, telefone, e-mail..."
              value={filters.search}
              onChange={(e) =>
                onFiltersChange({ ...filters, search: e.target.value })
              }
            />
          </div>

          {/* Etapa */}
          <div className="space-y-2">
            <Label>Status</Label>
            <Select
              value={filters.etapa}
              onValueChange={(value) =>
                onFiltersChange({ ...filters, etapa: value === '_all' ? '' : value })
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Todos os status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="_all">Todos os status</SelectItem>
                {ETAPAS.map((etapa) => (
                  <SelectItem key={etapa} value={etapa}>
                    {ETAPA_LABELS[etapa]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Origem */}
          <div className="space-y-2">
            <Label>Origem</Label>
            <Select
              value={filters.origem}
              onValueChange={(value) =>
                onFiltersChange({ ...filters, origem: value === '_all' ? '' : value })
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Todas as origens" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="_all">Todas as origens</SelectItem>
                {Object.entries(ORIGEM_LABELS).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Vendedor */}
          <div className="space-y-2">
            <Label>Responsável</Label>
            <Select
              value={filters.vendedor}
              onValueChange={(value) =>
                onFiltersChange({ ...filters, vendedor: value === '_all' ? '' : value })
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Todos os vendedores" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="_all">Todos os vendedores</SelectItem>
                {vendedores.map((v) => (
                  <SelectItem key={v.id} value={v.user_id}>
                    {v.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Date Range */}
          <div className="space-y-2">
            <Label>Período</Label>
            <DatePickerWithRange
              date={filters.dateRange}
              onDateChange={(range) =>
                onFiltersChange({ ...filters, dateRange: range })
              }
            />
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
