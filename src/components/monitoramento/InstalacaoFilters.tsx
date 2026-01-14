import { useState } from 'react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetFooter,
} from '@/components/ui/sheet';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';

interface FilterState {
  status: string[];
  periodo: string;
  dataInicio: string;
  dataFim: string;
  instalador: string;
  regiao: string;
  periodoDia: string[];
}

interface InstalacaoFiltersProps {
  open: boolean;
  onClose: () => void;
  onApply: (filters: FilterState) => void;
}

const statusOptions = [
  { value: 'pendente', label: 'Pendente' },
  { value: 'agendada', label: 'Agendada' },
  { value: 'em_rota', label: 'Em Rota' },
  { value: 'em_andamento', label: 'Em Andamento' },
  { value: 'concluida', label: 'Concluída' },
  { value: 'reagendada', label: 'Reagendada' },
  { value: 'cancelada', label: 'Cancelada' },
];

const periodoOptions = [
  { value: 'hoje', label: 'Hoje' },
  { value: 'amanha', label: 'Amanhã' },
  { value: 'esta_semana', label: 'Esta semana' },
  { value: 'proxima_semana', label: 'Próxima semana' },
  { value: 'este_mes', label: 'Este mês' },
  { value: 'personalizado', label: 'Personalizado' },
];

const instaladorOptions = [
  { value: '', label: 'Todos' },
  { value: 'joao', label: 'João Técnico' },
  { value: 'pedro', label: 'Pedro Instalador' },
  { value: 'maria', label: 'Maria Técnica' },
];

const regiaoOptions = [
  { value: '', label: 'Todas' },
  { value: 'sp_centro', label: 'São Paulo - Centro' },
  { value: 'sp_zona_sul', label: 'São Paulo - Zona Sul' },
  { value: 'campinas', label: 'Campinas' },
  { value: 'abc', label: 'ABC' },
];

const periodoDiaOptions = [
  { value: 'manha', label: 'Manhã' },
  { value: 'tarde', label: 'Tarde' },
  { value: 'noite', label: 'Noite' },
];

const initialFilters: FilterState = {
  status: [],
  periodo: '',
  dataInicio: '',
  dataFim: '',
  instalador: '',
  regiao: '',
  periodoDia: [],
};

export function InstalacaoFilters({ open, onClose, onApply }: InstalacaoFiltersProps) {
  const [filters, setFilters] = useState<FilterState>(initialFilters);

  const handleStatusToggle = (value: string) => {
    setFilters((prev) => ({
      ...prev,
      status: prev.status.includes(value)
        ? prev.status.filter((s) => s !== value)
        : [...prev.status, value],
    }));
  };

  const handlePeriodoDiaToggle = (value: string) => {
    setFilters((prev) => ({
      ...prev,
      periodoDia: prev.periodoDia.includes(value)
        ? prev.periodoDia.filter((p) => p !== value)
        : [...prev.periodoDia, value],
    }));
  };

  const handleClear = () => {
    setFilters(initialFilters);
  };

  const handleApply = () => {
    onApply(filters);
    onClose();
  };

  return (
    <Sheet open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <SheetContent side="right" className="w-80 flex flex-col">
        <SheetHeader>
          <SheetTitle>Filtros</SheetTitle>
        </SheetHeader>

        <ScrollArea className="flex-1 -mx-6 px-6">
          <div className="space-y-6 py-4">
            {/* Status - Checkboxes */}
            <div className="space-y-3">
              <Label className="text-sm font-medium">Status</Label>
              <div className="space-y-2">
                {statusOptions.map((option) => (
                  <div key={option.value} className="flex items-center space-x-2">
                    <Checkbox
                      id={`status-${option.value}`}
                      checked={filters.status.includes(option.value)}
                      onCheckedChange={() => handleStatusToggle(option.value)}
                    />
                    <Label
                      htmlFor={`status-${option.value}`}
                      className="text-sm font-normal cursor-pointer"
                    >
                      {option.label}
                    </Label>
                  </div>
                ))}
              </div>
            </div>

            {/* Período - RadioGroup */}
            <div className="space-y-3">
              <Label className="text-sm font-medium">Período</Label>
              <RadioGroup
                value={filters.periodo}
                onValueChange={(value) => setFilters((prev) => ({ ...prev, periodo: value }))}
              >
                {periodoOptions.map((option) => (
                  <div key={option.value} className="flex items-center space-x-2">
                    <RadioGroupItem value={option.value} id={`periodo-${option.value}`} />
                    <Label
                      htmlFor={`periodo-${option.value}`}
                      className="text-sm font-normal cursor-pointer"
                    >
                      {option.label}
                    </Label>
                  </div>
                ))}
              </RadioGroup>
            </div>

            {/* Datas - Condicional */}
            {filters.periodo === 'personalizado' && (
              <div className="space-y-3 p-3 bg-muted/50 rounded-lg">
                <div className="space-y-2">
                  <Label htmlFor="data-inicio" className="text-sm font-medium">
                    Data inicial
                  </Label>
                  <Input
                    id="data-inicio"
                    type="date"
                    value={filters.dataInicio}
                    onChange={(e) =>
                      setFilters((prev) => ({ ...prev, dataInicio: e.target.value }))
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="data-fim" className="text-sm font-medium">
                    Data final
                  </Label>
                  <Input
                    id="data-fim"
                    type="date"
                    value={filters.dataFim}
                    onChange={(e) =>
                      setFilters((prev) => ({ ...prev, dataFim: e.target.value }))
                    }
                  />
                </div>
              </div>
            )}

            {/* Instalador - Select */}
            <div className="space-y-3">
              <Label className="text-sm font-medium">Instalador</Label>
              <Select
                value={filters.instalador}
                onValueChange={(value) =>
                  setFilters((prev) => ({ ...prev, instalador: value }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o instalador" />
                </SelectTrigger>
                <SelectContent>
                  {instaladorOptions.map((option) => (
                    <SelectItem key={option.value || 'all'} value={option.value || 'all'}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Região - Select */}
            <div className="space-y-3">
              <Label className="text-sm font-medium">Região</Label>
              <Select
                value={filters.regiao}
                onValueChange={(value) => setFilters((prev) => ({ ...prev, regiao: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a região" />
                </SelectTrigger>
                <SelectContent>
                  {regiaoOptions.map((option) => (
                    <SelectItem key={option.value || 'all'} value={option.value || 'all'}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Período do Dia - Checkboxes */}
            <div className="space-y-3">
              <Label className="text-sm font-medium">Período do Dia</Label>
              <div className="space-y-2">
                {periodoDiaOptions.map((option) => (
                  <div key={option.value} className="flex items-center space-x-2">
                    <Checkbox
                      id={`periodo-dia-${option.value}`}
                      checked={filters.periodoDia.includes(option.value)}
                      onCheckedChange={() => handlePeriodoDiaToggle(option.value)}
                    />
                    <Label
                      htmlFor={`periodo-dia-${option.value}`}
                      className="text-sm font-normal cursor-pointer"
                    >
                      {option.label}
                    </Label>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </ScrollArea>

        <SheetFooter className="flex-shrink-0 gap-2 pt-4 border-t">
          <Button variant="outline" onClick={handleClear} className="flex-1">
            Limpar Filtros
          </Button>
          <Button onClick={handleApply} className="flex-1">
            Aplicar
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
