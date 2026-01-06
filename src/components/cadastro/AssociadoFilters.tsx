import { useState } from 'react';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { STATUS_ASSOCIADO_LABELS, type StatusAssociado } from '@/types/database';

interface AssociadoFiltersProps {
  open: boolean;
  onClose: () => void;
  onApply: (filters: {
    status?: StatusAssociado[];
    plano_id?: string;
    cidade?: string;
    periodo?: string;
  }) => void;
  initialFilters?: {
    status?: StatusAssociado | StatusAssociado[];
    plano_id?: string;
    cidade?: string;
    periodo?: string;
  };
  planos?: { id: string; nome: string }[];
  cidades?: string[];
}

const STATUS_OPTIONS: { value: StatusAssociado; label: string }[] = [
  { value: 'ativo', label: 'Ativo' },
  { value: 'suspenso', label: 'Suspenso' },
  { value: 'inadimplente', label: 'Inadimplente' },
  { value: 'cancelado', label: 'Cancelado' },
  { value: 'em_analise', label: 'Em Análise' },
  { value: 'bloqueado', label: 'Bloqueado' },
  { value: 'documentacao_pendente', label: 'Documentação Pendente' },
  { value: 'aguardando_instalacao', label: 'Aguardando Instalação' },
];

const PERIODO_OPTIONS = [
  { value: '', label: 'Qualquer período' },
  { value: 'ultimo_mes', label: 'Último mês' },
  { value: 'ultimos_3_meses', label: 'Últimos 3 meses' },
  { value: 'ultimo_ano', label: 'Último ano' },
];

export function AssociadoFilters({
  open,
  onClose,
  onApply,
  initialFilters,
  planos,
  cidades,
}: AssociadoFiltersProps) {
  const [statusSelecionados, setStatusSelecionados] = useState<StatusAssociado[]>(
    Array.isArray(initialFilters?.status) 
      ? initialFilters.status 
      : initialFilters?.status 
        ? [initialFilters.status] 
        : []
  );
  const [plano, setPlano] = useState(initialFilters?.plano_id || '');
  const [cidade, setCidade] = useState(initialFilters?.cidade || '');
  const [periodo, setPeriodo] = useState(initialFilters?.periodo || '');

  const handleStatusChange = (status: StatusAssociado, checked: boolean) => {
    if (checked) {
      setStatusSelecionados([...statusSelecionados, status]);
    } else {
      setStatusSelecionados(statusSelecionados.filter(s => s !== status));
    }
  };

  const handleApply = () => {
    const filters: {
      status?: StatusAssociado[];
      plano_id?: string;
      cidade?: string;
      periodo?: string;
    } = {};
    
    if (statusSelecionados.length > 0) {
      filters.status = statusSelecionados;
    }
    if (plano && plano !== 'all') {
      filters.plano_id = plano;
    }
    if (cidade) {
      filters.cidade = cidade;
    }
    if (periodo) {
      filters.periodo = periodo;
    }

    onApply(filters);
    onClose();
  };

  const handleLimpar = () => {
    setStatusSelecionados([]);
    setPlano('');
    setCidade('');
    setPeriodo('');
  };

  const activeCount = statusSelecionados.length + 
    (plano && plano !== 'all' ? 1 : 0) + 
    (cidade ? 1 : 0) + 
    (periodo ? 1 : 0);

  return (
    <Sheet open={open} onOpenChange={onClose}>
      <SheetContent className="flex flex-col">
        <SheetHeader>
          <SheetTitle>Filtros Avançados</SheetTitle>
          <SheetDescription>
            Refine a busca de associados
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto py-4 space-y-6">
          {/* STATUS */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">Status</Label>
            <div className="space-y-2">
              {STATUS_OPTIONS.map((option) => (
                <div key={option.value} className="flex items-center space-x-2">
                  <Checkbox
                    id={`status-${option.value}`}
                    checked={statusSelecionados.includes(option.value)}
                    onCheckedChange={(checked) =>
                      handleStatusChange(option.value, checked as boolean)
                    }
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

          <Separator />

          {/* PLANO */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">Plano</Label>
            <Select value={plano} onValueChange={setPlano}>
              <SelectTrigger>
                <SelectValue placeholder="Todos os planos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os planos</SelectItem>
                {planos?.map((p) => (
                  <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Separator />

          {/* CIDADE */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">Cidade</Label>
            {cidades && cidades.length > 0 ? (
              <Select value={cidade} onValueChange={setCidade}>
                <SelectTrigger>
                  <SelectValue placeholder="Todas as cidades" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Todas as cidades</SelectItem>
                  {cidades.map((c) => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <Input
                placeholder="Digite a cidade..."
                value={cidade}
                onChange={(e) => setCidade(e.target.value)}
              />
            )}
          </div>

          <Separator />

          {/* PERÍODO DE ADESÃO */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">Período de Adesão</Label>
            <RadioGroup value={periodo} onValueChange={setPeriodo}>
              {PERIODO_OPTIONS.map((option) => (
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
        </div>

        <SheetFooter className="flex-row gap-2 border-t pt-4">
          <Button variant="outline" onClick={handleLimpar} className="flex-1">
            Limpar
          </Button>
          <Button onClick={handleApply} className="flex-1">
            Aplicar {activeCount > 0 && `(${activeCount})`}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
