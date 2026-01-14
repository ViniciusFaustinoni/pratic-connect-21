import { useState } from 'react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
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
import { Separator } from '@/components/ui/separator';
import { Camera, Wrench, RefreshCw } from 'lucide-react';

interface FilterState {
  tipo: string;
  status: string[];
  periodo: string;
  dataInicio: string;
  dataFim: string;
  periodoDia: string[];
  instalador: string;
  regiao: string;
  rastreador: string;
  valorMin: string;
  valorMax: string;
}

interface InstalacaoFiltersProps {
  open: boolean;
  onClose: () => void;
  onApply: (filters: FilterState) => void;
}

const tipoOptions = [
  { value: 'todos', label: 'Todos', icon: null },
  { value: 'autovistoria', label: 'Autovistoria', icon: Camera },
  { value: 'instalacao', label: 'Instalação', icon: Wrench },
  { value: 'reinstalacao', label: 'Reinstalação', icon: RefreshCw },
];

const statusOptions = [
  { value: 'pendente', label: 'Pendente' },
  { value: 'agendada', label: 'Agendada' },
  { value: 'em_rota', label: 'Em Rota' },
  { value: 'em_andamento', label: 'Em Andamento' },
  { value: 'concluida', label: 'Concluída' },
  { value: 'aprovada', label: 'Aprovada' },
  { value: 'reprovada', label: 'Reprovada' },
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

const periodoDiaOptions = [
  { value: 'manha', label: 'Manhã (06h-12h)' },
  { value: 'tarde', label: 'Tarde (12h-18h)' },
  { value: 'noite', label: 'Noite (18h-22h)' },
];

const instaladorOptions = [
  { value: 'all', label: 'Todos os instaladores' },
  { value: 'joao', label: 'João Técnico' },
  { value: 'pedro', label: 'Pedro Instalador' },
  { value: 'maria', label: 'Maria Técnica' },
  { value: 'carlos', label: 'Carlos Técnico' },
  { value: 'sem_instalador', label: 'Sem instalador atribuído' },
];

const regiaoOptions = [
  { value: 'all', label: 'Todas as regiões' },
  { value: 'sp_centro', label: 'São Paulo - Centro' },
  { value: 'sp_zona_sul', label: 'São Paulo - Zona Sul' },
  { value: 'sp_zona_norte', label: 'São Paulo - Zona Norte' },
  { value: 'sp_zona_leste', label: 'São Paulo - Zona Leste' },
  { value: 'sp_zona_oeste', label: 'São Paulo - Zona Oeste' },
  { value: 'campinas', label: 'Campinas' },
  { value: 'abc', label: 'ABC Paulista' },
  { value: 'outras', label: 'Outras' },
];

const rastreadorOptions = [
  { value: 'todos', label: 'Todos' },
  { value: 'obrigatorio', label: 'Obrigatório (veículo > R$30k)' },
  { value: 'nao_necessario', label: 'Não necessário (veículo ≤ R$30k)' },
  { value: 'instalado', label: 'Já instalado' },
  { value: 'aguardando', label: 'Aguardando instalação' },
];

const initialFilters: FilterState = {
  tipo: 'todos',
  status: [],
  periodo: '',
  dataInicio: '',
  dataFim: '',
  periodoDia: [],
  instalador: '',
  regiao: '',
  rastreador: 'todos',
  valorMin: '',
  valorMax: '',
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
      <SheetContent side="right" className="w-96 flex flex-col p-0">
        <SheetHeader className="p-6 pb-4">
          <SheetTitle>Filtros Avançados</SheetTitle>
          <SheetDescription>Refine sua busca</SheetDescription>
        </SheetHeader>

        <ScrollArea className="flex-1 px-6">
          <div className="space-y-6 pb-6">
            {/* 1. Tipo de Registro */}
            <div className="space-y-3">
              <Label className="text-sm font-medium">Tipo</Label>
              <RadioGroup
                value={filters.tipo}
                onValueChange={(value) => setFilters((prev) => ({ ...prev, tipo: value }))}
              >
                {tipoOptions.map((option) => (
                  <div key={option.value} className="flex items-center space-x-2">
                    <RadioGroupItem value={option.value} id={`tipo-${option.value}`} />
                    <Label
                      htmlFor={`tipo-${option.value}`}
                      className="flex items-center gap-2 cursor-pointer"
                    >
                      {option.icon && <option.icon className="h-4 w-4 text-muted-foreground" />}
                      {option.label}
                    </Label>
                  </div>
                ))}
              </RadioGroup>
            </div>

            <Separator />

            {/* 2. Status */}
            <div className="space-y-3">
              <Label className="text-sm font-medium">Status</Label>
              <div className="grid grid-cols-2 gap-2">
                {statusOptions.map((option) => (
                  <div key={option.value} className="flex items-center space-x-2">
                    <Checkbox
                      id={`status-${option.value}`}
                      checked={filters.status.includes(option.value)}
                      onCheckedChange={() => handleStatusToggle(option.value)}
                    />
                    <Label
                      htmlFor={`status-${option.value}`}
                      className="text-sm cursor-pointer"
                    >
                      {option.label}
                    </Label>
                  </div>
                ))}
              </div>
            </div>

            <Separator />

            {/* 3. Período */}
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
                      className="cursor-pointer"
                    >
                      {option.label}
                    </Label>
                  </div>
                ))}
              </RadioGroup>
            </div>

            {/* 4. Datas Personalizadas (condicional) */}
            {filters.periodo === 'personalizado' && (
              <div className="space-y-3">
                <Label className="text-sm font-medium">Datas</Label>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">Data inicial</Label>
                    <Input
                      type="date"
                      value={filters.dataInicio}
                      onChange={(e) =>
                        setFilters((prev) => ({ ...prev, dataInicio: e.target.value }))
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">Data final</Label>
                    <Input
                      type="date"
                      value={filters.dataFim}
                      onChange={(e) =>
                        setFilters((prev) => ({ ...prev, dataFim: e.target.value }))
                      }
                    />
                  </div>
                </div>
              </div>
            )}

            <Separator />

            {/* 5. Período do Dia */}
            <div className="space-y-3">
              <Label className="text-sm font-medium">Horário</Label>
              <div className="flex flex-wrap gap-4">
                {periodoDiaOptions.map((option) => (
                  <div key={option.value} className="flex items-center space-x-2">
                    <Checkbox
                      id={`horario-${option.value}`}
                      checked={filters.periodoDia.includes(option.value)}
                      onCheckedChange={() => handlePeriodoDiaToggle(option.value)}
                    />
                    <Label
                      htmlFor={`horario-${option.value}`}
                      className="text-sm cursor-pointer"
                    >
                      {option.label}
                    </Label>
                  </div>
                ))}
              </div>
            </div>

            <Separator />

            {/* 6. Instalador */}
            <div className="space-y-3">
              <Label className="text-sm font-medium">Instalador</Label>
              <Select
                value={filters.instalador || 'all'}
                onValueChange={(value) =>
                  setFilters((prev) => ({ ...prev, instalador: value === 'all' ? '' : value }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um instalador" />
                </SelectTrigger>
                <SelectContent>
                  {instaladorOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Separator />

            {/* 7. Região */}
            <div className="space-y-3">
              <Label className="text-sm font-medium">Região</Label>
              <Select
                value={filters.regiao || 'all'}
                onValueChange={(value) =>
                  setFilters((prev) => ({ ...prev, regiao: value === 'all' ? '' : value }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione uma região" />
                </SelectTrigger>
                <SelectContent>
                  {regiaoOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Separator />

            {/* 8. Rastreador */}
            <div className="space-y-3">
              <Label className="text-sm font-medium">Rastreador</Label>
              <RadioGroup
                value={filters.rastreador}
                onValueChange={(value) => setFilters((prev) => ({ ...prev, rastreador: value }))}
              >
                {rastreadorOptions.map((option) => (
                  <div key={option.value} className="flex items-center space-x-2">
                    <RadioGroupItem value={option.value} id={`rastreador-${option.value}`} />
                    <Label htmlFor={`rastreador-${option.value}`} className="cursor-pointer">
                      {option.label}
                    </Label>
                  </div>
                ))}
              </RadioGroup>
            </div>

            <Separator />

            {/* 9. Faixa de Valor FIPE */}
            <div className="space-y-3">
              <Label className="text-sm font-medium">Faixa de valor FIPE</Label>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">Valor mínimo</Label>
                  <Input
                    type="number"
                    placeholder="R$ 0"
                    value={filters.valorMin}
                    onChange={(e) =>
                      setFilters((prev) => ({ ...prev, valorMin: e.target.value }))
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">Valor máximo</Label>
                  <Input
                    type="number"
                    placeholder="R$ 500.000"
                    value={filters.valorMax}
                    onChange={(e) =>
                      setFilters((prev) => ({ ...prev, valorMax: e.target.value }))
                    }
                  />
                </div>
              </div>
            </div>
          </div>
        </ScrollArea>

        {/* Footer fixo */}
        <div className="flex justify-between items-center p-6 border-t bg-background">
          <Button variant="outline" onClick={handleClear}>
            Limpar Filtros
          </Button>
          <Button onClick={handleApply}>
            Aplicar Filtros
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
