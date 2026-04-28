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
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { Check, ChevronsUpDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { STATUS_ASSOCIADO_LABELS, type StatusAssociado } from '@/types/database';

export interface SheetFiltersValue {
  status?: StatusAssociado[];
  plano_id?: string;
  cidade?: string;
  data_adesao_inicio?: string;
  data_adesao_fim?: string;
  vendedor_id?: string;
  tipos_entrada?: string[];
}

interface AssociadoFiltersProps {
  open: boolean;
  onClose: () => void;
  onApply: (filters: SheetFiltersValue) => void;
  initialFilters?: {
    status?: StatusAssociado | StatusAssociado[];
    plano_id?: string;
    cidade?: string;
    data_adesao_inicio?: string;
    data_adesao_fim?: string;
    vendedor_id?: string;
    tipos_entrada?: string[];
  };
  planos?: { id: string; nome: string }[];
  cidades?: string[];
  vendedores?: { id: string; nome: string }[];
}

const TIPO_ENTRADA_OPTIONS: { value: string; label: string }[] = [
  { value: 'adesao', label: 'Nova Adesão' },
  { value: 'inclusao', label: 'Inclusão de Veículo' },
  { value: 'substituicao_placa', label: 'Substituição de Placa' },
  { value: 'troca_titularidade', label: 'Troca de Titularidade' },
  { value: 'reativacao', label: 'Reativação' },
  { value: 'migracao', label: 'Migração' },
  { value: 'indicacao', label: 'Indicação' },
];

const STATUS_OPTIONS: { value: StatusAssociado; label: string }[] = [
  { value: 'ativo', label: 'Ativo' },
  { value: 'suspenso', label: 'Suspenso' },
  { value: 'inadimplente', label: 'Inadimplente' },
  { value: 'cancelado', label: 'Cancelado' },
  { value: 'em_analise', label: 'Em Análise' },
  { value: 'pendente_vistoria', label: 'Pendente de Vistoria' },
  { value: 'aprovado', label: 'Aprovado' },
  { value: 'bloqueado', label: 'Bloqueado' },
  { value: 'documentacao_pendente', label: 'Documentação Pendente' },
  { value: 'aguardando_instalacao', label: 'Aguardando Instalação' },
  { value: 'recusado', label: 'Recusado' },
];

function toIso(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function AssociadoFilters({
  open,
  onClose,
  onApply,
  initialFilters,
  planos,
  cidades,
  vendedores,
}: AssociadoFiltersProps) {
  const [statusSelecionados, setStatusSelecionados] = useState<StatusAssociado[]>(
    Array.isArray(initialFilters?.status)
      ? initialFilters.status
      : initialFilters?.status
        ? [initialFilters.status]
        : []
  );
  const [plano, setPlano] = useState(initialFilters?.plano_id || 'all');
  const [cidade, setCidade] = useState(initialFilters?.cidade || 'all');
  const [dataInicio, setDataInicio] = useState(initialFilters?.data_adesao_inicio || '');
  const [dataFim, setDataFim] = useState(initialFilters?.data_adesao_fim || '');
  const [vendedorId, setVendedorId] = useState(initialFilters?.vendedor_id || '');
  const [vendedorOpen, setVendedorOpen] = useState(false);
  const [tiposEntrada, setTiposEntrada] = useState<string[]>(
    initialFilters?.tipos_entrada || []
  );

  const handleStatusChange = (status: StatusAssociado, checked: boolean) => {
    if (checked) {
      setStatusSelecionados([...statusSelecionados, status]);
    } else {
      setStatusSelecionados(statusSelecionados.filter(s => s !== status));
    }
  };

  const handleTipoEntradaChange = (tipo: string, checked: boolean) => {
    if (checked) {
      setTiposEntrada([...tiposEntrada, tipo]);
    } else {
      setTiposEntrada(tiposEntrada.filter(t => t !== tipo));
    }
  };

  const aplicarAtalho = (tipo: 'mes' | '3meses' | 'ano') => {
    const hoje = new Date();
    const fim = toIso(hoje);
    let inicioDate: Date;
    if (tipo === 'mes') inicioDate = new Date(hoje.getFullYear(), hoje.getMonth() - 1, hoje.getDate());
    else if (tipo === '3meses') inicioDate = new Date(hoje.getFullYear(), hoje.getMonth() - 3, hoje.getDate());
    else inicioDate = new Date(hoje.getFullYear() - 1, hoje.getMonth(), hoje.getDate());
    setDataInicio(toIso(inicioDate));
    setDataFim(fim);
  };

  const handleApply = () => {
    const filters: SheetFiltersValue = {};
    if (statusSelecionados.length > 0) filters.status = statusSelecionados;
    if (plano && plano !== 'all') filters.plano_id = plano;
    if (cidade && cidade !== 'all') filters.cidade = cidade;
    if (dataInicio) filters.data_adesao_inicio = dataInicio;
    if (dataFim) filters.data_adesao_fim = dataFim;
    if (vendedorId) filters.vendedor_id = vendedorId;
    if (tiposEntrada.length > 0) filters.tipos_entrada = tiposEntrada;

    onApply(filters);
    onClose();
  };

  const handleLimpar = () => {
    setStatusSelecionados([]);
    setPlano('all');
    setCidade('all');
    setDataInicio('');
    setDataFim('');
    setVendedorId('');
    setTiposEntrada([]);
  };

  const activeCount =
    statusSelecionados.length +
    (plano && plano !== 'all' ? 1 : 0) +
    (cidade && cidade !== 'all' ? 1 : 0) +
    (dataInicio || dataFim ? 1 : 0) +
    (vendedorId ? 1 : 0) +
    tiposEntrada.length;

  const vendedorSelecionado = vendedores?.find(v => v.id === vendedorId);

  return (
    <Sheet open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <SheetContent className="flex flex-col">
        <SheetHeader>
          <SheetTitle>Filtros Avançados</SheetTitle>
          <SheetDescription>Refine a busca de associados</SheetDescription>
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

          {/* TIPO DE ADESÃO */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">Tipo de Adesão</Label>
            <div className="space-y-2">
              {TIPO_ENTRADA_OPTIONS.map((option) => (
                <div key={option.value} className="flex items-center space-x-2">
                  <Checkbox
                    id={`tipo-${option.value}`}
                    checked={tiposEntrada.includes(option.value)}
                    onCheckedChange={(checked) =>
                      handleTipoEntradaChange(option.value, checked as boolean)
                    }
                  />
                  <Label
                    htmlFor={`tipo-${option.value}`}
                    className="text-sm font-normal cursor-pointer"
                  >
                    {option.label}
                  </Label>
                </div>
              ))}
            </div>
          </div>

          <Separator />

          {/* CONSULTOR */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">Consultor</Label>
            <Popover open={vendedorOpen} onOpenChange={setVendedorOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  aria-expanded={vendedorOpen}
                  className="w-full justify-between font-normal"
                >
                  <span className="truncate">
                    {vendedorSelecionado?.nome || 'Todos os consultores'}
                  </span>
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                <Command>
                  <CommandInput placeholder="Buscar consultor..." />
                  <CommandList>
                    <CommandEmpty>Nenhum consultor encontrado.</CommandEmpty>
                    <CommandGroup>
                      <CommandItem
                        value="__all__"
                        onSelect={() => {
                          setVendedorId('');
                          setVendedorOpen(false);
                        }}
                      >
                        <Check
                          className={cn(
                            'mr-2 h-4 w-4',
                            !vendedorId ? 'opacity-100' : 'opacity-0'
                          )}
                        />
                        Todos os consultores
                      </CommandItem>
                      {vendedores?.map((v) => (
                        <CommandItem
                          key={v.id}
                          value={v.nome}
                          onSelect={() => {
                            setVendedorId(v.id);
                            setVendedorOpen(false);
                          }}
                        >
                          <Check
                            className={cn(
                              'mr-2 h-4 w-4',
                              vendedorId === v.id ? 'opacity-100' : 'opacity-0'
                            )}
                          />
                          {v.nome}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
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
                  <SelectItem value="all">Todas as cidades</SelectItem>
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

          {/* DATA DE ADESÃO */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">Data de Adesão</Label>
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" size="sm" onClick={() => aplicarAtalho('mes')}>
                Último mês
              </Button>
              <Button type="button" variant="outline" size="sm" onClick={() => aplicarAtalho('3meses')}>
                Últimos 3 meses
              </Button>
              <Button type="button" variant="outline" size="sm" onClick={() => aplicarAtalho('ano')}>
                Último ano
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => { setDataInicio(''); setDataFim(''); }}
              >
                Limpar
              </Button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label htmlFor="data-inicio" className="text-xs text-muted-foreground">De</Label>
                <Input
                  id="data-inicio"
                  type="date"
                  value={dataInicio}
                  onChange={(e) => setDataInicio(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="data-fim" className="text-xs text-muted-foreground">Até</Label>
                <Input
                  id="data-fim"
                  type="date"
                  value={dataFim}
                  onChange={(e) => setDataFim(e.target.value)}
                />
              </div>
            </div>
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
