import { useState, useMemo, useEffect, useRef } from 'react';
import { Search, Plus, Download, Send, X, Eye, MoreHorizontal, DollarSign, MessageSquare, Mail, FileText, RefreshCw, Loader2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Skeleton } from '@/components/ui/skeleton';
import { Checkbox } from '@/components/ui/checkbox';
import { useInfiniteQuery, useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import { format, isToday, parseISO, endOfMonth, startOfMonth } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';
import { NovaCobrancaModal } from '@/components/financeiro/NovaCobrancaModal';
import { RegistrarPagamentoModal } from '@/components/financeiro/RegistrarPagamentoModal';
import { BatchActionsBar } from '@/components/financeiro/BatchActionsBar';
import { SgaBackfillFinanceiroDialog } from '@/components/cobranca/SgaBackfillFinanceiroDialog';
import { CobrancaDetalheModal } from '@/components/cobranca/CobrancaDetalheModal';
import { usePermissions } from '@/hooks/usePermissions';

type StatusCanonico = 'pendente' | 'pago' | 'vencido' | 'cancelado';

const PAGE_SIZE = 50;

const statusConfig: Record<StatusCanonico, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  pendente: { label: 'Pendente', variant: 'secondary' },
  pago: { label: 'Pago', variant: 'default' },
  vencido: { label: 'Vencido', variant: 'destructive' },
  cancelado: { label: 'Cancelado', variant: 'outline' },
};

const tipoConfig: Record<string, { label: string }> = {
  mensalidade: { label: 'Mensalidade' },
  adesao: { label: 'Adesão' },
  taxa_instalacao: { label: 'Taxa Instalação' },
  taxa_vistoria: { label: 'Taxa Vistoria' },
  participacao_sinistro: { label: 'Part. Sinistro' },
  avulso: { label: 'Avulso' },
  MENSALIDADE: { label: 'Mensalidade' },
  ADESAO: { label: 'Adesão' },
};

const statusOptions = [
  { value: 'todos', label: 'Todos os status' },
  { value: 'pendente', label: 'Pendente' },
  { value: 'pago', label: 'Pago' },
  { value: 'vencido', label: 'Vencido' },
  { value: 'cancelado', label: 'Cancelado' },
];

const tipoOptions = [
  { value: 'todos', label: 'Todos os tipos' },
  { value: 'mensalidade', label: 'Mensalidade' },
  { value: 'adesao', label: 'Adesão' },
  { value: 'taxa_instalacao', label: 'Taxa Instalação' },
  { value: 'taxa_vistoria', label: 'Taxa Vistoria' },
  { value: 'participacao_sinistro', label: 'Part. Sinistro' },
  { value: 'avulso', label: 'Avulso' },
];

const origemOptions = [
  { value: 'todas', label: 'Todas as origens' },
  { value: 'asaas', label: 'Asaas' },
  { value: 'sga_hinova', label: 'SGA Hinova' },
  { value: 'csv_sga', label: 'CSV SGA (lote)' },
];

const meses = [
  { value: '0', label: 'Todos os meses' },
  { value: '1', label: 'Janeiro' }, { value: '2', label: 'Fevereiro' }, { value: '3', label: 'Março' },
  { value: '4', label: 'Abril' }, { value: '5', label: 'Maio' }, { value: '6', label: 'Junho' },
  { value: '7', label: 'Julho' }, { value: '8', label: 'Agosto' }, { value: '9', label: 'Setembro' },
  { value: '10', label: 'Outubro' }, { value: '11', label: 'Novembro' }, { value: '12', label: 'Dezembro' },
];

const getAnos = () => {
  const anoAtual = new Date().getFullYear();
  const anos = Array.from({ length: 5 }, (_, i) => ({ value: String(anoAtual - i), label: String(anoAtual - i) }));
  return [{ value: '0', label: 'Todos os anos' }, ...anos];
};

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

const formatCpfParcial = (cpf: string) => {
  if (!cpf) return '';
  const clean = cpf.replace(/\D/g, '');
  if (clean.length !== 11) return cpf;
  return `${clean.slice(0, 3)}.***.**${clean.slice(8, 9)}-${clean.slice(9)}`;
};

// Status raw -> canônico (com "vencido auto" para pendentes vencidos)
const toCanonical = (rawStatus: string, dataVencimento?: string | null): StatusCanonico => {
  const s = (rawStatus || '').toLowerCase();
  if (['received', 'confirmed', 'pago'].includes(s)) return 'pago';
  if (['canceled', 'cancelled', 'cancelado'].includes(s)) return 'cancelado';
  if (['overdue', 'vencido'].includes(s)) return 'vencido';
  if (['pending', 'pendente', 'aguardando_pagamento', 'aguardando'].includes(s)) {
    if (dataVencimento) {
      try {
        const venc = parseISO(dataVencimento);
        const hoje = new Date();
        hoje.setHours(0, 0, 0, 0);
        if (venc < hoje) return 'vencido';
      } catch { /* noop */ }
    }
    return 'pendente';
  }
  return 'pendente';
};

// Mapeia status canônico -> lista de status raw das tabelas (para filtro server-side)
const canonicoParaRawAsaas = (s: StatusCanonico): string[] => {
  switch (s) {
    case 'pago': return ['RECEIVED', 'CONFIRMED', 'pago'];
    case 'cancelado': return ['CANCELED', 'cancelado'];
    case 'vencido': return ['OVERDUE', 'vencido', 'PENDING', 'pendente']; // pendentes vencidos viram vencido
    case 'pendente': return ['PENDING', 'pendente'];
  }
};

const canonicoParaRawSga = (s: StatusCanonico): string[] => {
  switch (s) {
    case 'pago': return ['pago'];
    case 'cancelado': return ['cancelado'];
    case 'vencido': return ['vencido', 'aguardando_pagamento']; // pendentes vencidos
    case 'pendente': return ['aguardando_pagamento', 'pendente'];
  }
};

interface CobrancaUnificada {
  id: string;
  origem: 'asaas' | 'sga_hinova' | 'csv_sga';
  associado_id: string | null;
  associado: { id: string; nome: string; cpf: string; telefone?: string; whatsapp?: string; email?: string } | null;
  tipo: string;
  status_raw: string;
  status: StatusCanonico;
  valor: number;
  valor_pago: number;
  data_vencimento: string | null;
  competencia: string | null;
  boleto_url: string | null;
  pix_copia_cola: string | null;
  asaas_id: string | null;
  linha_digitavel: string | null;
  veiculo_id: string | null;
}

export default function CobrancasList() {
  const navigate = useNavigate();
  const { isDiretor, isAdminMaster, isDesenvolvedor } = usePermissions();
  const queryClient = useQueryClient();

  const [filters, setFilters] = useState({
    status: 'todos',
    tipo: 'todos',
    origem: 'todas' as 'todas' | 'asaas' | 'sga_hinova' | 'csv_sga',
    mes: new Date().getMonth() + 1,
    ano: new Date().getFullYear(),
    busca: '',
  });
  const [activeTab, setActiveTab] = useState<'todas' | StatusCanonico>('todas');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [modalNovaCobranca, setModalNovaCobranca] = useState(false);
  const [modalPagamento, setModalPagamento] = useState(false);
  const [cobrancaSelecionada, setCobrancaSelecionada] = useState<any>(null);
  const [enviandoLote, setEnviandoLote] = useState(false);
  const [enviandoPDF, setEnviandoPDF] = useState<string | null>(null);
  const [detalheId, setDetalheId] = useState<string | null>(null);

  // mes=0 OU ano=0 = "Todos" -> dataInicio/dataFim viram null e os filtros de data são omitidos
  const semFiltroData = filters.mes === 0 || filters.ano === 0;
  const dataInicio = useMemo(
    () => semFiltroData ? null : format(startOfMonth(new Date(filters.ano, filters.mes - 1, 1)), 'yyyy-MM-dd'),
    [filters.mes, filters.ano, semFiltroData],
  );
  const dataFim = useMemo(
    () => semFiltroData ? null : format(endOfMonth(new Date(filters.ano, filters.mes - 1, 1)), 'yyyy-MM-dd'),
    [filters.mes, filters.ano, semFiltroData],
  );

  // Status efetivo (filters.status OU activeTab — tab tem prioridade se diferente de "todas")
  const statusEfetivo: StatusCanonico | 'todos' = useMemo(() => {
    if (activeTab !== 'todas') return activeTab;
    if (filters.status !== 'todos') return filters.status as StatusCanonico;
    return 'todos';
  }, [filters.status, activeTab]);

  // ============ KPIs (server-side, agregando ambas as fontes) ============
  const { data: kpis, isLoading: loadingKpis } = useQuery({
    queryKey: ['cobrancas-kpis-unificado', dataInicio, dataFim, filters.origem, filters.tipo],
    queryFn: async () => {
      const fontes: Array<'asaas' | 'sga_hinova' | 'csv_sga'> = [];
      if (filters.origem === 'todas' || filters.origem === 'asaas') fontes.push('asaas');
      if (filters.origem === 'todas' || filters.origem === 'sga_hinova') fontes.push('sga_hinova');
      if (filters.origem === 'todas' || filters.origem === 'csv_sga') fontes.push('csv_sga');

      const totals = {
        total: 0,
        qtdPagas: 0, valorPagas: 0,
        qtdPendentes: 0, valorPendentes: 0,
        qtdVencidas: 0, valorVencidas: 0,
        qtdCanceladas: 0,
      };
      // Tabs (counts apenas)
      const tabCounts = { todas: 0, pendente: 0, pago: 0, vencido: 0, cancelado: 0 };

      const hojeIso = format(new Date(), 'yyyy-MM-dd');

      for (const fonte of fontes) {
        const tabela =
          fonte === 'asaas' ? 'asaas_cobrancas'
          : fonte === 'sga_hinova' ? 'cobrancas'
          : 'cobranca_csv_boletos';
        const valorPagoCol =
          fonte === 'asaas' ? 'pagamento_valor'
          : fonte === 'sga_hinova' ? 'valor_pago'
          : 'valor';
        const valorCol = fonte === 'csv_sga' ? 'valor' : 'valor';
        const statusCol = fonte === 'csv_sga' ? 'status_origem' : 'status';

        // Buscar APENAS colunas leves para agregar em memória
        let from = 0;
        const chunk = 1000;
        for (;;) {
          let q = supabase
            .from(tabela as any)
            .select(`${statusCol}, ${valorCol}, data_vencimento, ${valorPagoCol}`)
            .gte('data_vencimento', dataInicio)
            .lte('data_vencimento', dataFim)
            .range(from, from + chunk - 1);

          if (fonte === 'sga_hinova') q = q.eq('origem', 'sga_hinova');
          if (filters.tipo !== 'todos') q = q.ilike('tipo', `%${filters.tipo}%`);

          const { data, error } = await q;
          if (error) throw error;
          if (!data || data.length === 0) break;

          for (const row of data as any[]) {
            // CSV: status_origem ('Pago em dia'/'Não pago'/...) -> canonico
            let canonico: StatusCanonico;
            if (fonte === 'csv_sga') {
              const so = String(row.status_origem || '').toLowerCase();
              if (so.startsWith('pago')) canonico = 'pago';
              else canonico = toCanonical('aguardando_pagamento', row.data_vencimento);
            } else {
              canonico = toCanonical(row.status, row.data_vencimento);
            }
            const valor = Number(row[valorCol]) || 0;
            const valorPago = Number(row[valorPagoCol]) || 0;
            totals.total += 1;
            tabCounts.todas += 1;
            tabCounts[canonico] += 1;
            if (canonico === 'pago') {
              totals.qtdPagas += 1;
              totals.valorPagas += valorPago || valor;
            } else if (canonico === 'pendente') {
              totals.qtdPendentes += 1;
              totals.valorPendentes += valor;
            } else if (canonico === 'vencido') {
              totals.qtdVencidas += 1;
              totals.valorVencidas += valor;
            } else if (canonico === 'cancelado') {
              totals.qtdCanceladas += 1;
            }
          }

          if (data.length < chunk) break;
          from += chunk;
        }
      }

      return { ...totals, tabCounts, hojeIso };
    },
    staleTime: 60_000,
  });

  // ============ Lista paginada (infinite scroll) ============
  const {
    data: pages,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading: loadingLista,
    refetch: refetchLista,
  } = useInfiniteQuery({
    queryKey: ['cobrancas-lista-infinita', dataInicio, dataFim, filters.origem, filters.tipo, statusEfetivo],
    initialPageParam: 0,
    queryFn: async ({ pageParam }) => {
      const offset = pageParam as number;
      const fontes: Array<'asaas' | 'sga_hinova' | 'csv_sga'> = [];
      if (filters.origem === 'todas' || filters.origem === 'asaas') fontes.push('asaas');
      if (filters.origem === 'todas' || filters.origem === 'sga_hinova') fontes.push('sga_hinova');
      if (filters.origem === 'todas' || filters.origem === 'csv_sga') fontes.push('csv_sga');

      // Busca PAGE_SIZE de cada fonte em paralelo (offset igual nas duas), depois merge
      const promises = fontes.map(async (fonte): Promise<CobrancaUnificada[]> => {
        if (fonte === 'asaas') {
          let q = supabase
            .from('asaas_cobrancas')
            .select(`
              id, asaas_id, tipo, status, valor, pagamento_valor, data_vencimento,
              competencia, boleto_url, pix_copia_cola, associado_id, veiculo_id,
              linha_digitavel,
              associado:associados(id, nome, cpf, telefone, whatsapp, email)
            `)
            .gte('data_vencimento', dataInicio)
            .lte('data_vencimento', dataFim)
            .order('data_vencimento', { ascending: false })
            .order('id', { ascending: false })
            .range(offset, offset + PAGE_SIZE - 1);

          if (filters.tipo !== 'todos') q = q.ilike('tipo', `%${filters.tipo}%`);
          if (statusEfetivo !== 'todos') q = q.in('status', canonicoParaRawAsaas(statusEfetivo));

          const { data, error } = await q;
          if (error) throw error;
          return (data || []).map((c: any): CobrancaUnificada => ({
            id: c.id,
            origem: 'asaas',
            associado_id: c.associado_id,
            associado: c.associado,
            tipo: c.tipo,
            status_raw: c.status,
            status: toCanonical(c.status, c.data_vencimento),
            valor: Number(c.valor) || 0,
            valor_pago: Number(c.pagamento_valor) || 0,
            data_vencimento: c.data_vencimento,
            competencia: c.competencia,
            boleto_url: c.boleto_url,
            pix_copia_cola: c.pix_copia_cola,
            asaas_id: c.asaas_id,
            linha_digitavel: c.linha_digitavel || null,
            veiculo_id: c.veiculo_id || null,
          }));
        } else if (fonte === 'sga_hinova') {
          let q = supabase
            .from('cobrancas')
            .select(`
              id, tipo, status, valor, valor_pago, data_vencimento,
              referencia_mes, referencia_ano, boleto_url, pix_copia_cola,
              associado_id, origem, veiculo_id, linha_digitavel,
              associado:associados(id, nome, cpf, telefone, whatsapp, email)
            `)
            .eq('origem', 'sga_hinova')
            .gte('data_vencimento', dataInicio)
            .lte('data_vencimento', dataFim)
            .order('data_vencimento', { ascending: false })
            .order('id', { ascending: false })
            .range(offset, offset + PAGE_SIZE - 1);

          if (filters.tipo !== 'todos') q = q.ilike('tipo', `%${filters.tipo}%`);
          if (statusEfetivo !== 'todos') q = q.in('status', canonicoParaRawSga(statusEfetivo));

          const { data, error } = await q;
          if (error) throw error;
          return (data || []).map((c: any): CobrancaUnificada => ({
            id: c.id,
            origem: 'sga_hinova',
            associado_id: c.associado_id,
            associado: c.associado,
            tipo: c.tipo,
            status_raw: c.status,
            status: toCanonical(c.status, c.data_vencimento),
            valor: Number(c.valor) || 0,
            valor_pago: Number(c.valor_pago) || 0,
            data_vencimento: c.data_vencimento,
            competencia: c.referencia_mes && c.referencia_ano
              ? `${String(c.referencia_mes).padStart(2, '0')}/${c.referencia_ano}`
              : null,
            boleto_url: c.boleto_url,
            pix_copia_cola: c.pix_copia_cola,
            asaas_id: null,
            linha_digitavel: c.linha_digitavel || null,
            veiculo_id: c.veiculo_id || null,
          }));
        } else {
          // CSV SGA — boletos importados via Régua (somente leitura)
          let q = supabase
            .from('cobranca_csv_boletos')
            .select(`
              id, tipo, status_origem, valor, data_vencimento,
              associado_id, veiculo_id, linha_digitavel, matricula,
              associado:associados(id, nome, cpf, telefone, whatsapp, email)
            `)
            .gte('data_vencimento', dataInicio)
            .lte('data_vencimento', dataFim)
            .order('data_vencimento', { ascending: false })
            .order('id', { ascending: false })
            .range(offset, offset + PAGE_SIZE - 1);

          if (filters.tipo !== 'todos') q = q.ilike('tipo', `%${filters.tipo}%`);
          // status: filtramos client-side via status canonico (status_origem é texto livre do SGA)

          const { data, error } = await q;
          if (error) throw error;
          return (data || []).map((c: any): CobrancaUnificada => {
            const so = String(c.status_origem || '').toLowerCase();
            const canonico: StatusCanonico = so.startsWith('pago')
              ? 'pago'
              : toCanonical('aguardando_pagamento', c.data_vencimento);
            return {
              id: c.id,
              origem: 'csv_sga',
              associado_id: c.associado_id,
              associado: c.associado,
              tipo: c.tipo || 'mensalidade',
              status_raw: c.status_origem || 'aguardando_pagamento',
              status: canonico,
              valor: Number(c.valor) || 0,
              valor_pago: canonico === 'pago' ? Number(c.valor) || 0 : 0,
              data_vencimento: c.data_vencimento,
              competencia: c.data_vencimento
                ? `${c.data_vencimento.slice(5, 7)}/${c.data_vencimento.slice(0, 4)}`
                : null,
              boleto_url: null,
              pix_copia_cola: null,
              asaas_id: null,
              linha_digitavel: c.linha_digitavel || null,
              veiculo_id: c.veiculo_id || null,
            };
          });
        }
      });

      const blocos = await Promise.all(promises);
      const itens = blocos.flat().sort((a, b) => {
        const da = a.data_vencimento || '';
        const db = b.data_vencimento || '';
        if (db !== da) return db.localeCompare(da);
        return b.id.localeCompare(a.id);
      });

      // hasMore: se QUALQUER fonte trouxe PAGE_SIZE registros, ainda há mais nessa fonte
      const hasMore = blocos.some((b) => b.length === PAGE_SIZE);
      return { itens, hasMore, nextOffset: offset + PAGE_SIZE };
    },
    getNextPageParam: (lastPage) => (lastPage.hasMore ? lastPage.nextOffset : undefined),
  });

  const cobrancasCarregadas = useMemo<CobrancaUnificada[]>(() => {
    return (pages?.pages || []).flatMap((p) => p.itens);
  }, [pages]);

  // Filtros client-side:
  // 1) statusEfetivo (canônico) — necessário porque o filtro server-side traz status raw
  //    amplos (ex.: PENDING entra na busca por 'vencido' e a reclassificação por
  //    data_vencimento só acontece em toCanonical). Sem este filtro, pendentes a vencer
  //    aparecem na aba "Vencidas" e vencidos aparecem na aba "Pendentes".
  // 2) busca por nome/CPF.
  const cobrancasVisiveis = useMemo(() => {
    let lista = cobrancasCarregadas;
    if (statusEfetivo !== 'todos') {
      lista = lista.filter((c) => c.status === statusEfetivo);
    }
    if (filters.busca) {
      const busca = filters.busca.toLowerCase();
      lista = lista.filter(
        (c) => c.associado?.nome?.toLowerCase().includes(busca) || c.associado?.cpf?.includes(busca),
      );
    }
    return lista;
  }, [cobrancasCarregadas, filters.busca, statusEfetivo]);

  // Auto-fetch da próxima página quando o sentinela entra em viewport
  const sentinelaRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!sentinelaRef.current || !hasNextPage) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !isFetchingNextPage) {
          fetchNextPage();
        }
      },
      { rootMargin: '200px' },
    );
    observer.observe(sentinelaRef.current);
    return () => observer.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  // Limpa seleção ao trocar filtros
  useEffect(() => {
    setSelectedIds(new Set());
  }, [filters.mes, filters.ano, filters.origem, filters.tipo, filters.status, activeTab]);

  // Seleção em lote
  const handleSelectAll = () => {
    if (selectedIds.size === cobrancasVisiveis.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(cobrancasVisiveis.map((c) => c.id)));
    }
  };
  const handleSelectItem = (id: string) => {
    const novo = new Set(selectedIds);
    if (novo.has(id)) novo.delete(id);
    else novo.add(id);
    setSelectedIds(novo);
  };
  const clearSelection = () => setSelectedIds(new Set());

  // Cancelar (apenas Asaas)
  const cancelarCobranca = useMutation({
    mutationFn: async (asaasId: string) => {
      const { data, error } = await supabase.functions.invoke('asaas-cobrancas', {
        body: { action: 'cancelar', asaas_id: asaasId },
      });
      if (error) throw error;
      if (!data.success) throw new Error(data.error || 'Erro ao cancelar');
      return data;
    },
    onSuccess: () => {
      toast.success('Cobrança cancelada com sucesso!');
      queryClient.invalidateQueries({ queryKey: ['cobrancas-lista-infinita'] });
      queryClient.invalidateQueries({ queryKey: ['cobrancas-kpis-unificado'] });
    },
    onError: (error: Error) => toast.error(`Erro ao cancelar: ${error.message}`),
  });

  // Envios WhatsApp
  const handleEnviarBoletoPDF = async (cobranca: CobrancaUnificada) => {
    const telefone = cobranca.associado?.whatsapp || cobranca.associado?.telefone;
    if (!telefone) { toast.error('Associado sem telefone cadastrado'); return; }
    if (!cobranca.boleto_url) { toast.error('Boleto não disponível para envio'); return; }
    setEnviandoPDF(cobranca.id);
    try {
      const valor = formatCurrency(cobranca.valor);
      const vencimento = cobranca.data_vencimento
        ? format(parseISO(cobranca.data_vencimento), 'dd/MM/yyyy', { locale: ptBR })
        : '';
      const { error } = await supabase.functions.invoke('whatsapp-send-media', {
        body: {
          telefone: telefone.replace(/\D/g, ''),
          media_url: cobranca.boleto_url,
          media_type: 'document',
          mimetype: 'application/pdf',
          filename: `boleto_${cobranca.asaas_id || cobranca.id}.pdf`,
          caption: `📄 Boleto PRATICCAR\n💰 Valor: ${valor}\n📅 Vencimento: ${vencimento}`,
          referencia_tipo: 'cobranca',
          referencia_id: cobranca.id,
        },
      });
      if (error) throw error;
      toast.success('Boleto PDF enviado por WhatsApp!');
    } catch (err: any) {
      toast.error(`Erro ao enviar: ${err.message}`);
    } finally {
      setEnviandoPDF(null);
    }
  };

  const formatBRLLote = (v: number) =>
    'R$ ' + Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const formatDataLote = (iso?: string | null) =>
    iso ? format(parseISO(iso), 'dd/MM/yyyy', { locale: ptBR }) : '—';

  // ============================================================
  // ENVIO EM MASSA — WhatsApp template Meta `emissao_boleto_gerado_v2`
  // (já APROVADO pela Meta, contém a linha digitável como variável {{6}})
  // ============================================================
  const handleEnviarWhatsAppLote = async () => {
    const selecionadas = cobrancasVisiveis.filter((c) => selectedIds.has(c.id));
    if (selecionadas.length === 0) return;

    if (selecionadas.length > 100 && !confirm(
      `Você está prestes a enviar ${selecionadas.length} mensagens via WhatsApp.\nDeseja continuar?`
    )) return;

    setEnviandoLote(true);
    const ids = selecionadas.map((c) => c.id);

    // Buscar veículos para enriquecer dados (modelo/placa) sob demanda
    const veiculoIds = Array.from(new Set(selecionadas.map((c) => c.veiculo_id).filter(Boolean) as string[]));
    let veiculoMap = new Map<string, { modelo?: string; placa?: string }>();
    if (veiculoIds.length > 0) {
      const { data: vs } = await supabase
        .from('veiculos')
        .select('id, modelo, placa')
        .in('id', veiculoIds);
      veiculoMap = new Map((vs || []).map((v: any) => [v.id, { modelo: v.modelo, placa: v.placa }]));
    }

    let enviados = 0;
    let semTelefone = 0;
    let semLinhaDigitavel = 0;
    let falhas = 0;
    const errosDetalhe: string[] = [];

    const toastId = toast.loading(`Enviando WhatsApp 0/${selecionadas.length}...`);

    for (let i = 0; i < selecionadas.length; i++) {
      const cobranca = selecionadas[i];
      const telefone = cobranca.associado?.whatsapp || cobranca.associado?.telefone;
      if (!telefone) { semTelefone++; continue; }
      if (!cobranca.linha_digitavel) { semLinhaDigitavel++; continue; }

      const veic = cobranca.veiculo_id ? veiculoMap.get(cobranca.veiculo_id) : null;
      const params = [
        cobranca.associado?.nome || 'Associado',
        veic?.modelo || '—',
        veic?.placa || '—',
        formatDataLote(cobranca.data_vencimento),
        formatBRLLote(cobranca.valor),
        cobranca.linha_digitavel,
      ];

      try {
        const resp = await supabase.functions.invoke('whatsapp-send-text', {
          body: {
            telefone: telefone.replace(/\D/g, ''),
            mensagem: '',
            template_name: 'emissao_boleto_gerado_v2',
            template_params: params,
          },
        });
        if (resp.error) throw new Error(resp.error.message || String(resp.error));
        const data: any = resp.data || {};
        if (data.success === false) throw new Error(data.error || 'Falha desconhecida');
        enviados++;
      } catch (err: any) {
        falhas++;
        if (errosDetalhe.length < 5) {
          errosDetalhe.push(`${cobranca.associado?.nome || cobranca.id}: ${err.message}`);
        }
      }

      toast.loading(`Enviando WhatsApp ${i + 1}/${selecionadas.length}...`, { id: toastId });
      await new Promise((r) => setTimeout(r, 800));
    }

    setEnviandoLote(false);
    const resumoParts = [`${enviados} enviada(s)`];
    if (semTelefone) resumoParts.push(`${semTelefone} sem telefone`);
    if (semLinhaDigitavel) resumoParts.push(`${semLinhaDigitavel} sem linha digitável`);
    if (falhas) resumoParts.push(`${falhas} falha(s)`);
    const resumo = resumoParts.join(' • ');

    if (falhas > 0 || semTelefone > 0 || semLinhaDigitavel > 0) {
      toast.warning(`WhatsApp: ${resumo}`, {
        id: toastId,
        description: errosDetalhe.length > 0 ? errosDetalhe.join('\n') : undefined,
        duration: 10000,
      });
    } else {
      toast.success(`WhatsApp: ${resumo}`, { id: toastId });
    }
    void ids;
    clearSelection();
  };

  // Ação individual no menu (continua usando wa.me direto)
  const handleEnviarWhatsApp = (cobranca: CobrancaUnificada) => {
    const telefone = cobranca.associado?.whatsapp || cobranca.associado?.telefone;
    if (!telefone) { toast.error('Associado sem telefone cadastrado'); return; }
    const telefoneFormatado = telefone.replace(/\D/g, '');
    const valor = formatCurrency(cobranca.valor);
    const vencimento = cobranca.data_vencimento
      ? format(parseISO(cobranca.data_vencimento), 'dd/MM/yyyy', { locale: ptBR })
      : '';
    let mensagem = `Olá ${cobranca.associado?.nome || ''}! 👋\n\n`;
    mensagem += `Segue sua cobrança:\n`;
    mensagem += `💰 Valor: ${valor}\n`;
    mensagem += `📅 Vencimento: ${vencimento}\n`;
    if (cobranca.linha_digitavel) mensagem += `\n💳 Linha digitável:\n${cobranca.linha_digitavel}\n`;
    if (cobranca.boleto_url) mensagem += `\n📄 Boleto: ${cobranca.boleto_url}\n`;
    if (cobranca.pix_copia_cola) mensagem += `\n📱 PIX Copia e Cola:\n${cobranca.pix_copia_cola}\n`;
    window.open(`https://wa.me/55${telefoneFormatado}?text=${encodeURIComponent(mensagem)}`, '_blank');
  };

  // ============================================================
  // ENVIO EM MASSA — E-mail (template `boleto-vencendo` com linha digitável)
  // ============================================================
  const handleEnviarEmailLote = async () => {
    const selecionadas = cobrancasVisiveis.filter((c) => selectedIds.has(c.id));
    if (selecionadas.length === 0) return;

    if (selecionadas.length > 100 && !confirm(
      `Você está prestes a enviar ${selecionadas.length} e-mails.\nDeseja continuar?`
    )) return;

    setEnviandoLote(true);

    let enviados = 0;
    let semEmail = 0;
    let semLinhaDigitavel = 0;
    let falhas = 0;
    const errosDetalhe: string[] = [];

    const hoje = new Date();
    const toastId = toast.loading(`Enviando e-mail 0/${selecionadas.length}...`);

    for (let i = 0; i < selecionadas.length; i++) {
      const cobranca = selecionadas[i];
      const email = cobranca.associado?.email;
      if (!email) { semEmail++; continue; }
      if (!cobranca.linha_digitavel) { semLinhaDigitavel++; continue; }

      const venc = cobranca.data_vencimento ? parseISO(cobranca.data_vencimento) : null;
      const diasRestantes = venc
        ? Math.round((venc.getTime() - hoje.getTime()) / 86400000)
        : 0;

      try {
        const resp = await supabase.functions.invoke('send-email', {
          body: {
            template: 'boleto-vencendo',
            to: email,
            data: {
              nome: cobranca.associado?.nome || 'Associado',
              valor: formatBRLLote(cobranca.valor).replace('R$ ', ''),
              vencimento: formatDataLote(cobranca.data_vencimento),
              competencia: cobranca.competencia || '—',
              boletoUrl: cobranca.boleto_url || '',
              linhaDigitavel: cobranca.linha_digitavel,
              diasRestantes: diasRestantes >= 0 ? diasRestantes : Math.abs(diasRestantes),
              vencido: diasRestantes < 0,
            },
          },
        });
        if (resp.error) throw new Error(resp.error.message || String(resp.error));
        enviados++;
      } catch (err: any) {
        falhas++;
        if (errosDetalhe.length < 5) {
          errosDetalhe.push(`${cobranca.associado?.nome || cobranca.id}: ${err.message}`);
        }
      }

      toast.loading(`Enviando e-mail ${i + 1}/${selecionadas.length}...`, { id: toastId });
      await new Promise((r) => setTimeout(r, 500));
    }

    setEnviandoLote(false);
    const resumoParts = [`${enviados} enviado(s)`];
    if (semEmail) resumoParts.push(`${semEmail} sem e-mail`);
    if (semLinhaDigitavel) resumoParts.push(`${semLinhaDigitavel} sem linha digitável`);
    if (falhas) resumoParts.push(`${falhas} falha(s)`);
    const resumo = resumoParts.join(' • ');

    if (falhas > 0 || semEmail > 0 || semLinhaDigitavel > 0) {
      toast.warning(`E-mail: ${resumo}`, {
        id: toastId,
        description: errosDetalhe.length > 0 ? errosDetalhe.join('\n') : undefined,
        duration: 10000,
      });
    } else {
      toast.success(`E-mail: ${resumo}`, { id: toastId });
    }
    clearSelection();
  };
  const handleReemitirLote = () => { toast.info(`Reemitindo ${selectedIds.size} cobrança(s)...`); clearSelection(); };

  const clearFilters = () => {
    setFilters({
      status: 'todos', tipo: 'todos', origem: 'todas',
      mes: new Date().getMonth() + 1, ano: new Date().getFullYear(), busca: '',
    });
    setActiveTab('todas');
  };

  const isVencendoHoje = (dataVencimento?: string | null) => {
    if (!dataVencimento) return false;
    try { return isToday(parseISO(dataVencimento)); } catch { return false; }
  };

  const getRowClass = (cobranca: CobrancaUnificada) => {
    if (cobranca.status === 'vencido') return 'bg-destructive/5';
    if (isVencendoHoje(cobranca.data_vencimento)) return 'bg-yellow-50 dark:bg-yellow-900/10';
    return '';
  };

  // Exporta TODOS os registros do filtro atual (faz fetch completo paginado)
  const handleExportar = async () => {
    toast.info('Preparando exportação completa...');
    try {
      const fontes: Array<'asaas' | 'sga_hinova'> = [];
      if (filters.origem === 'todas' || filters.origem === 'asaas') fontes.push('asaas');
      if (filters.origem === 'todas' || filters.origem === 'sga_hinova') fontes.push('sga_hinova');

      const linhas: string[] = [];
      for (const fonte of fontes) {
        const tabela = fonte === 'asaas' ? 'asaas_cobrancas' : 'cobrancas';
        let from = 0;
        const chunk = 1000;
        for (;;) {
          let q = supabase
            .from(tabela as any)
            .select('tipo, status, valor, data_vencimento, associado:associados(nome, cpf)')
            .gte('data_vencimento', dataInicio)
            .lte('data_vencimento', dataFim)
            .range(from, from + chunk - 1);
          if (fonte === 'sga_hinova') q = q.eq('origem', 'sga_hinova');
          if (filters.tipo !== 'todos') q = q.ilike('tipo', `%${filters.tipo}%`);
          if (statusEfetivo !== 'todos') {
            q = q.in('status', fonte === 'asaas' ? canonicoParaRawAsaas(statusEfetivo) : canonicoParaRawSga(statusEfetivo));
          }
          const { data, error } = await q;
          if (error) throw error;
          if (!data || data.length === 0) break;
          for (const c of data as any[]) {
            linhas.push(`"${fonte}","${c.associado?.nome || ''}","${c.associado?.cpf || ''}","${c.tipo}","${c.valor}","${c.data_vencimento || ''}","${c.status}"`);
          }
          if (data.length < chunk) break;
          from += chunk;
        }
      }

      if (linhas.length === 0) { toast.error('Nenhuma cobrança para exportar'); return; }
      const headers = 'Origem,Nome,CPF,Tipo,Valor,Vencimento,Status\n';
      const blob = new Blob([headers + linhas.join('\n')], { type: 'text/csv;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `cobrancas_${filters.mes}_${filters.ano}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(`${linhas.length} cobrança(s) exportada(s)!`);
    } catch (err: any) {
      toast.error(`Erro ao exportar: ${err.message}`);
    }
  };

  const tabCounts = kpis?.tabCounts || { todas: 0, pendente: 0, pago: 0, vencido: 0, cancelado: 0 };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Cobranças</h1>
          <p className="text-muted-foreground">Gerencie cobranças do Asaas e do histórico SGA Hinova</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {/* Botão "Sincronizar Financeiro (Hinova)" desativado — agora a fonte de cobranças é o import CSV. */}
          <Button variant="outline" onClick={handleExportar}>
            <Download className="mr-2 h-4 w-4" />Exportar
          </Button>
          <Button onClick={() => setModalNovaCobranca(true)}>
            <Plus className="mr-2 h-4 w-4" />Nova Cobrança
          </Button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Total</p>
            <p className="text-2xl font-bold">{loadingKpis ? '...' : kpis?.total || 0}</p>
            <p className="text-xs text-muted-foreground">cobranças</p>
          </CardContent>
        </Card>
        <Card className="border-green-200 dark:border-green-800">
          <CardContent className="p-4">
            <p className="text-sm text-green-600 dark:text-green-400">Pagas</p>
            <p className="text-2xl font-bold text-green-600 dark:text-green-400">{loadingKpis ? '...' : kpis?.qtdPagas || 0}</p>
            <p className="text-xs text-green-600/80 dark:text-green-400/80">{formatCurrency(kpis?.valorPagas || 0)}</p>
          </CardContent>
        </Card>
        <Card className="border-yellow-200 dark:border-yellow-800">
          <CardContent className="p-4">
            <p className="text-sm text-yellow-600 dark:text-yellow-400">Pendentes</p>
            <p className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">{loadingKpis ? '...' : kpis?.qtdPendentes || 0}</p>
            <p className="text-xs text-yellow-600/80 dark:text-yellow-400/80">{formatCurrency(kpis?.valorPendentes || 0)}</p>
          </CardContent>
        </Card>
        <Card className="border-red-200 dark:border-red-800">
          <CardContent className="p-4">
            <p className="text-sm text-destructive">Vencidas</p>
            <p className="text-2xl font-bold text-destructive">{loadingKpis ? '...' : kpis?.qtdVencidas || 0}</p>
            <p className="text-xs text-destructive/80">{formatCurrency(kpis?.valorVencidas || 0)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Filtros */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap gap-4 items-end">
            <div className="flex-1 min-w-[200px]">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar nas páginas carregadas..."
                  value={filters.busca}
                  onChange={(e) => setFilters((prev) => ({ ...prev, busca: e.target.value }))}
                  className="pl-9"
                />
              </div>
            </div>
            <Select value={filters.origem} onValueChange={(value: any) => setFilters((prev) => ({ ...prev, origem: value }))}>
              <SelectTrigger className="w-[160px]"><SelectValue placeholder="Origem" /></SelectTrigger>
              <SelectContent>
                {origemOptions.map((opt) => <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={filters.status} onValueChange={(value) => setFilters((prev) => ({ ...prev, status: value }))}>
              <SelectTrigger className="w-[160px]"><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent>
                {statusOptions.map((opt) => <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={filters.tipo} onValueChange={(value) => setFilters((prev) => ({ ...prev, tipo: value }))}>
              <SelectTrigger className="w-[160px]"><SelectValue placeholder="Tipo" /></SelectTrigger>
              <SelectContent>
                {tipoOptions.map((opt) => <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={String(filters.mes)} onValueChange={(value) => setFilters((prev) => ({ ...prev, mes: Number(value) }))}>
              <SelectTrigger className="w-[140px]"><SelectValue placeholder="Mês" /></SelectTrigger>
              <SelectContent>
                {meses.map((m) => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={String(filters.ano)} onValueChange={(value) => setFilters((prev) => ({ ...prev, ano: Number(value) }))}>
              <SelectTrigger className="w-[100px]"><SelectValue placeholder="Ano" /></SelectTrigger>
              <SelectContent>
                {getAnos().map((a) => <SelectItem key={a.value} value={a.value}>{a.label}</SelectItem>)}
              </SelectContent>
            </Select>
            <Button variant="ghost" size="sm" onClick={clearFilters}>
              <X className="mr-1 h-4 w-4" />Limpar
            </Button>
            <Button variant="ghost" size="sm" onClick={() => refetchLista()}>
              <RefreshCw className="mr-1 h-4 w-4" />Atualizar
            </Button>
          </div>
        </CardContent>
      </Card>

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
        <TabsList>
          <TabsTrigger value="todas">Todas ({tabCounts.todas})</TabsTrigger>
          <TabsTrigger value="pendente">Pendentes ({tabCounts.pendente})</TabsTrigger>
          <TabsTrigger value="pago">Pagas ({tabCounts.pago})</TabsTrigger>
          <TabsTrigger value="vencido">Vencidas ({tabCounts.vencido})</TabsTrigger>
          <TabsTrigger value="cancelado">Canceladas ({tabCounts.cancelado})</TabsTrigger>
        </TabsList>
      </Tabs>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[50px]">
                  <Checkbox
                    checked={cobrancasVisiveis.length > 0 && selectedIds.size === cobrancasVisiveis.length}
                    onCheckedChange={handleSelectAll}
                  />
                </TableHead>
                <TableHead>Associado</TableHead>
                <TableHead>Origem</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Referência</TableHead>
                <TableHead className="text-right">Valor</TableHead>
                <TableHead>Vencimento</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-[60px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loadingLista && cobrancasVisiveis.length === 0 ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell><Skeleton className="h-4 w-4" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-8" /></TableCell>
                  </TableRow>
                ))
              ) : cobrancasVisiveis.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                    Nenhuma cobrança encontrada
                  </TableCell>
                </TableRow>
              ) : (
                cobrancasVisiveis.map((cobranca) => (
                  <TableRow key={`${cobranca.origem}-${cobranca.id}`} className={getRowClass(cobranca)}>
                    <TableCell>
                      <Checkbox
                        checked={selectedIds.has(cobranca.id)}
                        onCheckedChange={() => handleSelectItem(cobranca.id)}
                      />
                    </TableCell>
                    <TableCell>
                      <div>
                        <p className="font-medium">{cobranca.associado?.nome || 'N/A'}</p>
                        <p className="text-xs text-muted-foreground">{formatCpfParcial(cobranca.associado?.cpf || '')}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={cobranca.origem === 'asaas' ? 'default' : cobranca.origem === 'csv_sga' ? 'outline' : 'secondary'}>
                        {cobranca.origem === 'asaas' ? 'Asaas' : cobranca.origem === 'csv_sga' ? 'CSV SGA' : 'SGA'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{tipoConfig[cobranca.tipo]?.label || cobranca.tipo}</Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{cobranca.competencia || '-'}</TableCell>
                    <TableCell className="text-right font-medium">{formatCurrency(cobranca.valor)}</TableCell>
                    <TableCell>
                      {cobranca.data_vencimento ? format(parseISO(cobranca.data_vencimento), 'dd/MM/yyyy', { locale: ptBR }) : '-'}
                    </TableCell>
                    <TableCell>
                      <Badge variant={statusConfig[cobranca.status].variant}>{statusConfig[cobranca.status].label}</Badge>
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon"><MoreHorizontal className="h-4 w-4" /></Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => setDetalheId(cobranca.id)}>
                            <Eye className="mr-2 h-4 w-4" />Ver detalhes
                          </DropdownMenuItem>
                          {!['pago', 'cancelado'].includes(cobranca.status) && (
                            <>
                              <DropdownMenuItem onClick={() => { setCobrancaSelecionada(cobranca); setModalPagamento(true); }}>
                                <DollarSign className="mr-2 h-4 w-4" />Registrar Pagamento
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleEnviarWhatsApp(cobranca)}>
                                <MessageSquare className="mr-2 h-4 w-4" />WhatsApp (link)
                              </DropdownMenuItem>
                              {cobranca.boleto_url && (
                                <DropdownMenuItem onClick={() => handleEnviarBoletoPDF(cobranca)} disabled={enviandoPDF === cobranca.id}>
                                  {enviandoPDF === cobranca.id ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileText className="mr-2 h-4 w-4" />}
                                  Enviar Boleto PDF
                                </DropdownMenuItem>
                              )}
                              {cobranca.origem === 'asaas' && cobranca.asaas_id && (
                                <>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem
                                    className="text-destructive"
                                    onClick={() => {
                                      if (confirm('Tem certeza que deseja cancelar esta cobrança?')) {
                                        cancelarCobranca.mutate(cobranca.asaas_id!);
                                      }
                                    }}
                                  >
                                    <X className="mr-2 h-4 w-4" />Cancelar
                                  </DropdownMenuItem>
                                </>
                              )}
                            </>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Sentinela + botão "Carregar mais" */}
      <div ref={sentinelaRef} className="flex flex-col items-center gap-2 py-4">
        <p className="text-sm text-muted-foreground">
          Mostrando {cobrancasVisiveis.length} de {kpis?.total ?? '...'} cobranças
          {filters.busca && ` (filtrado por busca em ${cobrancasCarregadas.length} carregadas)`}
        </p>
        {hasNextPage && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => fetchNextPage()}
            disabled={isFetchingNextPage}
          >
            {isFetchingNextPage ? (
              <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Carregando...</>
            ) : (
              'Carregar mais'
            )}
          </Button>
        )}
        {!hasNextPage && cobrancasCarregadas.length > 0 && (
          <p className="text-xs text-muted-foreground">Fim dos resultados</p>
        )}
      </div>

      <NovaCobrancaModal open={modalNovaCobranca} onClose={() => setModalNovaCobranca(false)} />
      <RegistrarPagamentoModal
        open={modalPagamento}
        onClose={() => { setModalPagamento(false); setCobrancaSelecionada(null); }}
        cobranca={cobrancaSelecionada}
      />
      <CobrancaDetalheModal
        id={detalheId}
        open={!!detalheId}
        onOpenChange={(o) => !o && setDetalheId(null)}
      />

      <BatchActionsBar
        selectedCount={selectedIds.size}
        onClear={clearSelection}
        actions={[
          {
            label: enviandoLote ? 'Enviando...' : 'WhatsApp',
            icon: enviandoLote ? <Loader2 className="h-4 w-4 animate-spin" /> : <MessageSquare className="h-4 w-4" />,
            onClick: handleEnviarWhatsAppLote,
            disabled: enviandoLote,
          },
          {
            label: enviandoLote ? 'Enviando...' : 'E-mail',
            icon: enviandoLote ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />,
            onClick: handleEnviarEmailLote,
            disabled: enviandoLote,
          },
          { label: 'Reemitir', icon: <RefreshCw className="h-4 w-4" />, onClick: handleReemitirLote },
        ]}
      />
    </div>
  );
}
