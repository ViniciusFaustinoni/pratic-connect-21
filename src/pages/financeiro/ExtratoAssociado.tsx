import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { format, parseISO, subMonths, differenceInDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Search, User, Phone, Car, ChevronDown, ChevronRight, FileText, Calendar, DollarSign, AlertTriangle } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DatePickerWithRange } from '@/components/ui/date-range-picker';
import type { DateRange } from 'react-day-picker';
import type { Json } from '@/integrations/supabase/types';

// ── Config maps ──

const statusConfig: Record<string, { label: string; color: string }> = {
  PENDING: { label: 'Pendente', color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400' },
  RECEIVED: { label: 'Pago', color: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' },
  CONFIRMED: { label: 'Confirmado', color: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' },
  OVERDUE: { label: 'Vencido', color: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400' },
  REFUNDED: { label: 'Estornado', color: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400' },
  REFUND_REQUESTED: { label: 'Estorno solicitado', color: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400' },
  CHARGEBACK_REQUESTED: { label: 'Chargeback', color: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400' },
  CHARGEBACK_DISPUTE: { label: 'Em disputa', color: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400' },
  AWAITING_CHARGEBACK_REVERSAL: { label: 'Aguardando reversão', color: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400' },
  DUNNING_REQUESTED: { label: 'Em recuperação', color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400' },
  DUNNING_RECEIVED: { label: 'Recuperado', color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400' },
  AWAITING_RISK_ANALYSIS: { label: 'Análise de risco', color: 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400' },
  pago: { label: 'Pago', color: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' },
  pendente: { label: 'Pendente', color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400' },
  vencido: { label: 'Vencido', color: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400' },
  cancelado: { label: 'Cancelado', color: 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400' },
};

const tipoConfig: Record<string, { label: string; color: string }> = {
  mensalidade: { label: 'Mensalidade', color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400' },
  adesao: { label: 'Adesão', color: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-400' },
  taxa_vistoria: { label: 'Taxa Vistoria', color: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900/30 dark:text-cyan-400' },
  taxa_instalacao: { label: 'Taxa Instalação', color: 'bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-400' },
  taxa_rastreador: { label: 'Taxa Rastreador', color: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400' },
  avulsa: { label: 'Avulsa', color: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400' },
  acordo: { label: 'Acordo', color: 'bg-violet-100 text-violet-800 dark:bg-violet-900/30 dark:text-violet-400' },
};

const associadoStatusConfig: Record<string, { label: string; color: string }> = {
  ativo: { label: 'Ativo', color: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' },
  inadimplente: { label: 'Inadimplente', color: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400' },
  cancelado: { label: 'Cancelado', color: 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400' },
  pendente: { label: 'Pendente', color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400' },
  bloqueado: { label: 'Bloqueado', color: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400' },
  aprovado: { label: 'Aprovado', color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400' },
};

const formatCurrency = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

function formatCPF(cpf: string) {
  const d = cpf.replace(/\D/g, '');
  if (d.length !== 11) return cpf;
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
}

// ── Composição detail component ──

function ComposicaoDetalhe({ cobrancaId }: { cobrancaId: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ['cobranca-composicao', cobrancaId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('cobrancas_composicao')
        .select('*, veiculo:veiculos(placa, marca, modelo)')
        .eq('cobranca_id', cobrancaId);
      if (error) throw error;
      return data;
    },
  });

  if (isLoading) return <div className="p-4 space-y-2"><Skeleton className="h-4 w-full" /><Skeleton className="h-4 w-3/4" /></div>;
  if (!data?.length) return <p className="p-4 text-sm text-muted-foreground">Nenhuma composição encontrada.</p>;

  const totalGeral = data.reduce((acc, c) => {
    return acc + (c.valor_taxa_administrativa || 0)
      + (c.valor_rateio_roubo_furto || 0) + (c.valor_rateio_colisao || 0)
      + (c.valor_rateio_incendio || 0) + (c.valor_rateio_terceiros || 0)
      + (c.valor_rateio_vidros || 0) + (c.valor_rateio_assistencia || 0)
      + (c.valor_adicionais || 0);
  }, 0);

  return (
    <div className="bg-muted/40 rounded-lg p-4 space-y-4">
      {data.map((comp) => {
        const veiculo = comp.veiculo as { placa: string; marca: string; modelo: string } | null;
        const subtotal = (comp.valor_taxa_administrativa || 0)
          + (comp.valor_rateio_roubo_furto || 0) + (comp.valor_rateio_colisao || 0)
          + (comp.valor_rateio_incendio || 0) + (comp.valor_rateio_terceiros || 0)
          + (comp.valor_rateio_vidros || 0) + (comp.valor_rateio_assistencia || 0)
          + (comp.valor_adicionais || 0);

        const adicionaisDetalhes = comp.valor_adicionais_detalhes as Record<string, number> | null;

        return (
          <div key={comp.id} className="border rounded-md p-3 bg-background space-y-2">
            <div className="flex items-center gap-2 font-medium text-sm">
              <Car className="h-4 w-4 text-muted-foreground" />
              {veiculo ? `${veiculo.placa} - ${veiculo.marca} ${veiculo.modelo}` : 'Veículo não identificado'}
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-1 text-xs">
              <LineItem label="Taxa Administrativa" value={comp.valor_taxa_administrativa} />
              <LineItem label="Rateio Roubo/Furto" value={comp.valor_rateio_roubo_furto} />
              <LineItem label="Rateio Colisão" value={comp.valor_rateio_colisao} />
              <LineItem label="Rateio Incêndio" value={comp.valor_rateio_incendio} />
              <LineItem label="Rateio Terceiros" value={comp.valor_rateio_terceiros} />
              <LineItem label="Rateio Vidros" value={comp.valor_rateio_vidros} />
              <LineItem label="Rateio Assistência" value={comp.valor_rateio_assistencia} />
              {adicionaisDetalhes && Object.entries(adicionaisDetalhes).map(([k, v]) => (
                <LineItem key={k} label={k} value={v as number} />
              ))}
            </div>
            <div className="text-right text-sm font-semibold border-t pt-1">
              Subtotal: {formatCurrency(subtotal)}
            </div>
          </div>
        );
      })}
      <div className="text-right text-base font-bold border-t pt-2">
        Total Composição: {formatCurrency(totalGeral)}
      </div>
    </div>
  );
}

function LineItem({ label, value }: { label: string; value: number | null }) {
  if (!value) return null;
  return (
    <div className="flex justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{formatCurrency(value)}</span>
    </div>
  );
}

// ── Cobranca row ──

function CobrancaRow({ cobranca }: { cobranca: any }) {
  const [open, setOpen] = useState(false);
  const isMensalidade = cobranca.tipo === 'mensalidade';
  const dataExibida = cobranca.data_pagamento || cobranca.data_vencimento;
  const isPago = ['RECEIVED', 'CONFIRMED', 'pago'].includes(cobranca.status);

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger asChild>
        <div className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer hover:bg-muted/50 transition-colors ${isMensalidade ? '' : 'cursor-default'}`}>
          <div className="flex-shrink-0 w-5">
            {isMensalidade && (open ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />)}
          </div>

          <div className="w-20 text-xs text-muted-foreground">
            {dataExibida ? format(parseISO(dataExibida), 'dd/MM/yyyy') : '—'}
          </div>

          <Badge className={`text-[10px] px-1.5 py-0 ${tipoConfig[cobranca.tipo]?.color || 'bg-gray-100 text-gray-800'}`}>
            {tipoConfig[cobranca.tipo]?.label || cobranca.tipo}
          </Badge>

          <div className="flex-1 text-sm truncate">
            {cobranca.referencia || cobranca.competencia || '—'}
          </div>

          <div className="text-sm font-medium text-right w-24">
            {formatCurrency(Number(cobranca.valor) || 0)}
          </div>

          <Badge className={`text-[10px] px-1.5 py-0 ${statusConfig[cobranca.status]?.color || 'bg-gray-100 text-gray-800'}`}>
            {statusConfig[cobranca.status]?.label || cobranca.status}
          </Badge>

          <div className="text-sm text-right w-24">
            {isPago && cobranca.pagamento_valor ? (
              <span className="text-green-600 dark:text-green-400 font-medium">{formatCurrency(Number(cobranca.pagamento_valor))}</span>
            ) : '—'}
          </div>
        </div>
      </CollapsibleTrigger>
      {isMensalidade && (
        <CollapsibleContent>
          <div className="ml-8 mb-2">
            <ComposicaoDetalhe cobrancaId={cobranca.id} />
          </div>
        </CollapsibleContent>
      )}
    </Collapsible>
  );
}

// ── Main page ──

export default function ExtratoAssociado() {
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedTerm, setDebouncedTerm] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showDropdown, setShowDropdown] = useState(false);
  const [dateRange, setDateRange] = useState<DateRange | undefined>();
  const [filtroTipo, setFiltroTipo] = useState('todos');
  const [filtroStatus, setFiltroStatus] = useState('todos');
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Debounce
  useEffect(() => {
    const t = setTimeout(() => setDebouncedTerm(searchTerm), 300);
    return () => clearTimeout(t);
  }, [searchTerm]);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) setShowDropdown(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Search associados
  const { data: searchResults, isLoading: searchLoading } = useQuery({
    queryKey: ['extrato-search', debouncedTerm],
    queryFn: async () => {
      const term = `%${debouncedTerm}%`;
      const { data, error } = await supabase
        .from('associados')
        .select('id, nome, cpf, status, telefone')
        .or(`nome.ilike.${term},cpf.ilike.${term}`)
        .limit(10);
      if (error) throw error;
      return data;
    },
    enabled: debouncedTerm.length >= 3,
  });

  // Selected associado details
  const { data: associado } = useQuery({
    queryKey: ['extrato-associado', selectedId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('associados')
        .select('id, nome, cpf, telefone, status, whatsapp')
        .eq('id', selectedId!)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!selectedId,
  });

  // Vehicle count
  const { data: veiculosCount } = useQuery({
    queryKey: ['extrato-veiculos', selectedId],
    queryFn: async () => {
      const { count, error } = await supabase
        .from('veiculos')
        .select('id', { count: 'exact', head: true })
        .eq('associado_id', selectedId!);
      if (error) throw error;
      return count || 0;
    },
    enabled: !!selectedId,
  });

  // Cobranças
  const { data: cobrancas, isLoading: cobrancasLoading } = useQuery({
    queryKey: ['extrato-cobrancas', selectedId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('asaas_cobrancas')
        .select('*')
        .eq('associado_id', selectedId!)
        .order('data_vencimento', { ascending: false })
        .limit(200);
      if (error) throw error;
      return data;
    },
    enabled: !!selectedId,
  });

  // Financial summary
  const resumo = useMemo(() => {
    if (!cobrancas) return { pago12m: 0, aberto: 0, vencido: 0 };
    const hoje = new Date();
    const doze = subMonths(hoje, 12);
    let pago12m = 0, aberto = 0, vencido = 0;
    for (const c of cobrancas) {
      if (['RECEIVED', 'CONFIRMED', 'pago'].includes(c.status)) {
        const dp = c.data_pagamento || c.pagamento_data;
        if (dp && parseISO(dp) >= doze) pago12m += Number(c.pagamento_valor || c.valor) || 0;
      } else if (['OVERDUE', 'vencido'].includes(c.status)) {
        vencido += Number(c.valor) || 0;
      } else if (['PENDING', 'pendente'].includes(c.status)) {
        aberto += Number(c.valor) || 0;
      }
    }
    return { pago12m, aberto, vencido };
  }, [cobrancas]);

  // Filtered + grouped
  const grouped = useMemo(() => {
    if (!cobrancas) return {};
    let filtered = cobrancas;
    if (filtroTipo !== 'todos') filtered = filtered.filter(c => c.tipo === filtroTipo);
    if (filtroStatus !== 'todos') filtered = filtered.filter(c => c.status === filtroStatus);
    if (dateRange?.from) filtered = filtered.filter(c => parseISO(c.data_vencimento) >= dateRange.from!);
    if (dateRange?.to) filtered = filtered.filter(c => parseISO(c.data_vencimento) <= dateRange.to!);

    const groups: Record<string, typeof filtered> = {};
    for (const c of filtered) {
      const key = format(parseISO(c.data_vencimento), 'MMMM yyyy', { locale: ptBR });
      if (!groups[key]) groups[key] = [];
      groups[key].push(c);
    }
    return groups;
  }, [cobrancas, filtroTipo, filtroStatus, dateRange]);

  const handleSelect = useCallback((id: string) => {
    setSelectedId(id);
    setShowDropdown(false);
    setSearchTerm('');
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Extrato por Associado</h1>
        <p className="text-muted-foreground text-sm">Busque um associado para visualizar o extrato financeiro completo</p>
      </div>

      {/* Search */}
      <div className="relative" ref={dropdownRef}>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome ou CPF..."
            value={searchTerm}
            onChange={e => { setSearchTerm(e.target.value); setShowDropdown(true); }}
            onFocus={() => searchResults?.length && setShowDropdown(true)}
            className="pl-10"
          />
        </div>
        {showDropdown && debouncedTerm.length >= 3 && (
          <div className="absolute z-50 w-full mt-1 bg-popover border rounded-lg shadow-lg max-h-60 overflow-auto">
            {searchLoading ? (
              <div className="p-3 space-y-2"><Skeleton className="h-8 w-full" /><Skeleton className="h-8 w-full" /></div>
            ) : searchResults?.length ? (
              searchResults.map(a => (
                <button key={a.id} onClick={() => handleSelect(a.id)} className="w-full text-left px-4 py-2.5 hover:bg-muted flex items-center gap-3 transition-colors">
                  <User className="h-4 w-4 text-muted-foreground shrink-0" />
                  <div className="flex-1 min-w-0">
                    <span className="font-medium text-sm">{a.nome}</span>
                    <span className="text-xs text-muted-foreground ml-2">{formatCPF(a.cpf)}</span>
                  </div>
                  <Badge className={`text-[10px] ${associadoStatusConfig[a.status]?.color || ''}`}>
                    {associadoStatusConfig[a.status]?.label || a.status}
                  </Badge>
                </button>
              ))
            ) : (
              <p className="p-3 text-sm text-muted-foreground text-center">Nenhum associado encontrado</p>
            )}
          </div>
        )}
      </div>

      {/* Profile card */}
      {associado && (
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                  <User className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold">{associado.nome}</h2>
                  <div className="flex items-center gap-3 text-sm text-muted-foreground">
                    <span>{formatCPF(associado.cpf)}</span>
                    <span className="flex items-center gap-1"><Phone className="h-3 w-3" />{associado.telefone}</span>
                    <span className="flex items-center gap-1"><Car className="h-3 w-3" />{veiculosCount ?? 0} veículo(s)</span>
                  </div>
                </div>
                <Badge className={`ml-2 ${associadoStatusConfig[associado.status]?.color || ''}`}>
                  {associadoStatusConfig[associado.status]?.label || associado.status}
                </Badge>
              </div>
              <div className="flex gap-4">
                <SummaryBox label="Pago (12m)" value={resumo.pago12m} color="text-green-600 dark:text-green-400" />
                <SummaryBox label="Em aberto" value={resumo.aberto} color="text-yellow-600 dark:text-yellow-400" />
                <SummaryBox label="Vencido" value={resumo.vencido} color="text-red-600 dark:text-red-400" />
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Filters + Extrato */}
      {selectedId && (
        <>
          <div className="flex flex-wrap gap-3 items-end">
            <div className="w-48">
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Tipo</label>
              <Select value={filtroTipo} onValueChange={setFiltroTipo}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  {Object.entries(tipoConfig).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="w-48">
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Status</label>
              <Select value={filtroStatus} onValueChange={setFiltroStatus}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  <SelectItem value="PENDING">Pendente</SelectItem>
                  <SelectItem value="RECEIVED">Pago</SelectItem>
                  <SelectItem value="OVERDUE">Vencido</SelectItem>
                  <SelectItem value="CONFIRMED">Confirmado</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="w-64">
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Período</label>
              <DatePickerWithRange date={dateRange} onDateChange={setDateRange} />
            </div>
          </div>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Extrato de Cobranças
              </CardTitle>
            </CardHeader>
            <CardContent>
              {cobrancasLoading ? (
                <div className="space-y-3">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
              ) : Object.keys(grouped).length === 0 ? (
                <p className="text-center text-muted-foreground py-8">Nenhuma cobrança encontrada</p>
              ) : (
                <div className="space-y-1">
                  {/* Header */}
                  <div className="flex items-center gap-3 px-3 py-2 text-xs font-medium text-muted-foreground border-b">
                    <div className="w-5" />
                    <div className="w-20">Data</div>
                    <div className="w-24">Tipo</div>
                    <div className="flex-1">Referência</div>
                    <div className="w-24 text-right">Valor</div>
                    <div className="w-24">Status</div>
                    <div className="w-24 text-right">Pago</div>
                  </div>

                  {Object.entries(grouped).map(([mesAno, items]) => (
                    <div key={mesAno}>
                      <div className="flex items-center gap-2 py-2 px-3">
                        <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{mesAno}</span>
                        <Separator className="flex-1" />
                      </div>
                      {items.map(c => <CobrancaRow key={c.id} cobranca={c} />)}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

function SummaryBox({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="text-center px-4 py-2 rounded-lg bg-muted/50">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`text-sm font-bold ${color}`}>{formatCurrency(value)}</p>
    </div>
  );
}
