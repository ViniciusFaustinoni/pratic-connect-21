import { format } from 'date-fns';
import { CalendarIcon, CalendarDays, ListChecks, User, AlertTriangle, SlidersHorizontal, X } from 'lucide-react';
import { etapaVendaConfig, type EtapaVenda } from '@/lib/cotacaoEtapa';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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
  SheetTrigger,
  SheetFooter,
} from '@/components/ui/sheet';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { useState } from 'react';

export interface CotacoesFiltrosSheetProps {
  // estado
  statusFilter: string;
  setStatusFilter: (v: string) => void;
  mesFilter: string;
  setMesFilter: (v: string) => void;
  dataFilter: Date | undefined;
  setDataFilter: (v: Date | undefined) => void;
  consultorFilter: string;
  setConsultorFilter: (v: string) => void;
  etapaFunilFilter: string;
  setEtapaFunilFilter: (v: string) => void;
  filtroOrfas: boolean;
  setFiltroOrfas: (v: boolean) => void;
  // dados auxiliares
  mesesDisponiveis: string[];
  formatMesLabel: (m: string) => string;
  vendedores?: Array<{ user_id: string; nome: string }>;
  showStatusEPeriodo: boolean; // só na aba "em_andamento"
  showConsultor: boolean;
  showOrfas: boolean;
  // contagem
  activeCount: number;
  onClear: () => void;
}

export function CotacoesFiltrosSheet(props: CotacoesFiltrosSheetProps) {
  const [open, setOpen] = useState(false);
  const {
    statusFilter, setStatusFilter,
    mesFilter, setMesFilter,
    dataFilter, setDataFilter,
    consultorFilter, setConsultorFilter,
    etapaFunilFilter, setEtapaFunilFilter,
    filtroOrfas, setFiltroOrfas,
    mesesDisponiveis, formatMesLabel,
    vendedores,
    showStatusEPeriodo, showConsultor, showOrfas,
    activeCount, onClear,
  } = props;

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="outline" size="sm" className="h-9 px-3 shrink-0 relative">
          <SlidersHorizontal className="h-4 w-4 mr-1.5" />
          Filtros
          {activeCount > 0 && (
            <Badge variant="secondary" className="ml-1.5 h-5 px-1.5 text-[10px] bg-primary text-primary-foreground">
              {activeCount}
            </Badge>
          )}
        </Button>
      </SheetTrigger>
      <SheetContent side="bottom" className="max-h-[85vh] overflow-y-auto rounded-t-2xl">
        <SheetHeader>
          <SheetTitle className="text-left">Filtros</SheetTitle>
        </SheetHeader>

        <div className="space-y-4 mt-4 pb-2">
          {showStatusEPeriodo && (
            <>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Status</label>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-full h-10">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos status</SelectItem>
                    <SelectItem value="rascunho">Rascunho</SelectItem>
                    <SelectItem value="enviada">Enviada</SelectItem>
                    <SelectItem value="visualizada">Visualizada</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Período (mês)</label>
                <Select value={mesFilter} onValueChange={setMesFilter}>
                  <SelectTrigger className="w-full h-10">
                    <CalendarIcon className="h-4 w-4 mr-1.5 text-muted-foreground" />
                    <SelectValue placeholder="Período" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos períodos</SelectItem>
                    {mesesDisponiveis.map((mes) => (
                      <SelectItem key={mes} value={mes}>{formatMesLabel(mes)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </>
          )}

          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Etapa do funil</label>
            <Select value={etapaFunilFilter} onValueChange={setEtapaFunilFilter}>
              <SelectTrigger className="w-full h-10">
                <ListChecks className="h-4 w-4 mr-1.5 text-muted-foreground" />
                <SelectValue placeholder="Etapa do funil" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as etapas</SelectItem>
                <SelectItem value="rascunho">Rascunho</SelectItem>
                {([
                  'cotacao_realizada',
                  'escolhendo_plano',
                  'enviando_documentos',
                  'escolha_vistoria',
                  'realizando_autovistoria',
                  'assinando_contrato',
                  'realizando_pagamento',
                  'aguardando_vistoria',
                  'vistoria_agendada',
                  'instalacao_agendada',
                  'realizando_vistoria',
                  'vistoria_realizada',
                  'em_analise',
                  'associado_ativo',
                  'veiculo_recusado',
                  'cancelado',
                ] as EtapaVenda[]).map((etapa) => (
                  <SelectItem key={etapa} value={etapa}>
                    {etapaVendaConfig[etapa].label}
                  </SelectItem>
                ))}
                <SelectItem value="expirada">Expirada</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Data específica</label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full h-10 justify-start font-normal",
                    !dataFilter && "text-muted-foreground"
                  )}
                >
                  <CalendarDays className="h-4 w-4 mr-2" />
                  {dataFilter ? format(dataFilter, 'dd/MM/yyyy') : 'Selecione uma data'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={dataFilter}
                  onSelect={setDataFilter}
                  initialFocus
                  className="p-3 pointer-events-auto"
                />
                {dataFilter && (
                  <div className="p-2 border-t">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="w-full"
                      onClick={() => setDataFilter(undefined)}
                    >
                      Limpar data
                    </Button>
                  </div>
                )}
              </PopoverContent>
            </Popover>
          </div>

          {showConsultor && (
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Consultor</label>
              <Select value={consultorFilter} onValueChange={setConsultorFilter}>
                <SelectTrigger className="w-full h-10">
                  <User className="h-4 w-4 mr-1.5 text-muted-foreground" />
                  <SelectValue placeholder="Consultor" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos consultores</SelectItem>
                  {vendedores?.map((v) => (
                    <SelectItem key={v.user_id} value={v.user_id}>{v.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {showOrfas && (
            <Button
              variant={filtroOrfas ? 'default' : 'outline'}
              onClick={() => setFiltroOrfas(!filtroOrfas)}
              className="w-full h-10"
            >
              <AlertTriangle className="h-4 w-4 mr-2" />
              {filtroOrfas ? 'Mostrando apenas sem lead' : 'Apenas sem Lead'}
            </Button>
          )}
        </div>

        <SheetFooter className="flex-row gap-2 sm:flex-row">
          <Button
            variant="outline"
            className="flex-1"
            onClick={() => {
              onClear();
              setOpen(false);
            }}
            disabled={activeCount === 0}
          >
            <X className="h-4 w-4 mr-1.5" />
            Limpar tudo
          </Button>
          <Button className="flex-1" onClick={() => setOpen(false)}>
            Aplicar
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
