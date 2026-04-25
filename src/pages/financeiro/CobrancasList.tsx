import { useState, useMemo } from 'react';
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
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import { format, isToday, parseISO, endOfMonth, startOfMonth } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';
import { NovaCobrancaModal } from '@/components/financeiro/NovaCobrancaModal';
import { RegistrarPagamentoModal } from '@/components/financeiro/RegistrarPagamentoModal';
import { BatchActionsBar } from '@/components/financeiro/BatchActionsBar';
import { SgaBackfillFinanceiroDialog } from '@/components/cobranca/SgaBackfillFinanceiroDialog';
import { usePermissions } from '@/hooks/usePermissions';

// Status canônicos exibidos na UI: pendente | pago | vencido | cancelado
type StatusCanonico = 'pendente' | 'pago' | 'vencido' | 'cancelado';

const statusConfig: Record<StatusCanonico, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  pendente: { label: 'Pendente', variant: 'secondary' },
  pago: { label: 'Pago', variant: 'default' },
  vencido: { label: 'Vencido', variant: 'destructive' },
  cancelado: { label: 'Cancelado', variant: 'outline' },
};

const tipoConfig: Record<string, { label: string }> = {
  'mensalidade': { label: 'Mensalidade' },
  'adesao': { label: 'Adesão' },
  'taxa_instalacao': { label: 'Taxa Instalação' },
  'taxa_vistoria': { label: 'Taxa Vistoria' },
  'participacao_sinistro': { label: 'Part. Sinistro' },
  'avulso': { label: 'Avulso' },
  'MENSALIDADE': { label: 'Mensalidade' },
  'ADESAO': { label: 'Adesão' },
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
];

const meses = [
  { value: '1', label: 'Janeiro' },
  { value: '2', label: 'Fevereiro' },
  { value: '3', label: 'Março' },
  { value: '4', label: 'Abril' },
  { value: '5', label: 'Maio' },
  { value: '6', label: 'Junho' },
  { value: '7', label: 'Julho' },
  { value: '8', label: 'Agosto' },
  { value: '9', label: 'Setembro' },
  { value: '10', label: 'Outubro' },
  { value: '11', label: 'Novembro' },
  { value: '12', label: 'Dezembro' },
];

const getAnos = () => {
  const anoAtual = new Date().getFullYear();
  return Array.from({ length: 5 }, (_, i) => ({
    value: String(anoAtual - i),
    label: String(anoAtual - i),
  }));
};

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

const formatCpfParcial = (cpf: string) => {
  if (!cpf) return '';
  const clean = cpf.replace(/\D/g, '');
  if (clean.length !== 11) return cpf;
  return `${clean.slice(0, 3)}.***.**${clean.slice(8, 9)}-${clean.slice(9)}`;
};

// Mapeia o status bruto (qualquer fonte) -> status canônico
// Para "aguardando_pagamento" (Hinova) e "PENDING" (Asaas), checa a data de vencimento.
const toCanonical = (rawStatus: string, dataVencimento?: string | null): StatusCanonico => {
  const s = (rawStatus || '').toLowerCase();

  // Pago
  if (['received', 'confirmed', 'pago'].includes(s)) return 'pago';

  // Cancelado
  if (['canceled', 'cancelled', 'cancelado'].includes(s)) return 'cancelado';

  // Vencido (status explícito)
  if (['overdue', 'vencido'].includes(s)) return 'vencido';

  // Pendente / aguardando_pagamento -> verifica vencimento
  if (['pending', 'pendente', 'aguardando_pagamento', 'aguardando'].includes(s)) {
    if (dataVencimento) {
      try {
        const venc = parseISO(dataVencimento);
        const hoje = new Date();
        hoje.setHours(0, 0, 0, 0);
        if (venc < hoje) return 'vencido';
      } catch {
        // ignora parse error
      }
    }
    return 'pendente';
  }

  // Fallback: pendente
  return 'pendente';
};

interface CobrancaUnificada {
  id: string;
  origem: 'asaas' | 'sga_hinova';
  associado_id: string | null;
  associado: { id: string; nome: string; cpf: string; telefone?: string; whatsapp?: string } | null;
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
}

export default function CobrancasList() {
  const navigate = useNavigate();
  const { isDiretor, isAdminMaster, isDesenvolvedor } = usePermissions();
  const queryClient = useQueryClient();

  const [filters, setFilters] = useState({
    status: 'todos',
    tipo: 'todos',
    origem: 'todas' as 'todas' | 'asaas' | 'sga_hinova',
    mes: new Date().getMonth() + 1,
    ano: new Date().getFullYear(),
    busca: '',
  });
  const [activeTab, setActiveTab] = useState('todas');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 25;

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [modalNovaCobranca, setModalNovaCobranca] = useState(false);
  const [modalPagamento, setModalPagamento] = useState(false);
  const [cobrancaSelecionada, setCobrancaSelecionada] = useState<any>(null);
  const [enviandoLote, setEnviandoLote] = useState(false);
  const [enviandoPDF, setEnviandoPDF] = useState<string | null>(null);

  // Janela de datas (vencimento) — usada para AMBAS as fontes
  const dataInicio = useMemo(() => {
    const d = startOfMonth(new Date(filters.ano, filters.mes - 1, 1));
    return format(d, 'yyyy-MM-dd');
  }, [filters.mes, filters.ano]);

  const dataFim = useMemo(() => {
    const d = endOfMonth(new Date(filters.ano, filters.mes - 1, 1));
    return format(d, 'yyyy-MM-dd');
  }, [filters.mes, filters.ano]);

  // ============ QUERY UNIFICADA: Asaas + SGA ============
  const { data: cobrancas, isLoading } = useQuery<CobrancaUnificada[]>({
    queryKey: ['cobrancas-lista-unificada', filters.mes, filters.ano, filters.origem, filters.tipo],
    queryFn: async () => {
      const promises: Promise<CobrancaUnificada[]>[] = [];

      // Asaas
      if (filters.origem === 'todas' || filters.origem === 'asaas') {
        const promiseAsaas = (async () => {
          let q = supabase
            .from('asaas_cobrancas')
            .select(`
              id, asaas_id, tipo, status, valor, pagamento_valor, data_vencimento,
              competencia, boleto_url, pix_copia_cola, associado_id,
              associado:associados(id, nome, cpf, telefone, whatsapp)
            `)
            .gte('data_vencimento', dataInicio)
            .lte('data_vencimento', dataFim)
            .order('data_vencimento', { ascending: false });

          if (filters.tipo !== 'todos') {
            q = q.ilike('tipo', `%${filters.tipo}%`);
          }
          const { data, error } = await q.limit(1000);
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
          }));
        })();
        promises.push(promiseAsaas);
      }

      // SGA Hinova (tabela `cobrancas` com origem = 'sga_hinova')
      if (filters.origem === 'todas' || filters.origem === 'sga_hinova') {
        const promiseSga = (async () => {
          let q = supabase
            .from('cobrancas')
            .select(`
              id, tipo, status, valor, valor_pago, data_vencimento,
              referencia_mes, referencia_ano, boleto_url, pix_copia_cola,
              associado_id, origem,
              associado:associados(id, nome, cpf, telefone, whatsapp)
            `)
            .eq('origem', 'sga_hinova')
            .gte('data_vencimento', dataInicio)
            .lte('data_vencimento', dataFim)
            .order('data_vencimento', { ascending: false });

          if (filters.tipo !== 'todos') {
            q = q.ilike('tipo', `%${filters.tipo}%`);
          }
          const { data, error } = await q.limit(1000);
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
          }));
        })();
        promises.push(promiseSga);
      }

      const resultados = await Promise.all(promises);
      return resultados.flat().sort((a, b) => {
        const da = a.data_vencimento || '';
        const db = b.data_vencimento || '';
        return db.localeCompare(da);
      });
    },
  });

  // ============ KPIs (somam ambas as fontes via cobrancas já carregadas) ============
  const kpis = useMemo(() => {
    if (!cobrancas) return { total: 0, qtdPagas: 0, valorPagas: 0, qtdPendentes: 0, valorPendentes: 0, qtdVencidas: 0, valorVencidas: 0 };

    const pagas = cobrancas.filter(c => c.status === 'pago');
    const pendentes = cobrancas.filter(c => c.status === 'pendente');
    const vencidas = cobrancas.filter(c => c.status === 'vencido');

    return {
      total: cobrancas.length,
      qtdPagas: pagas.length,
      valorPagas: pagas.reduce((acc, c) => acc + (c.valor_pago || c.valor), 0),
      qtdPendentes: pendentes.length,
      valorPendentes: pendentes.reduce((acc, c) => acc + c.valor, 0),
      qtdVencidas: vencidas.length,
      valorVencidas: vencidas.reduce((acc, c) => acc + c.valor, 0),
    };
  }, [cobrancas]);

  // ============ Filtragem (busca + status + tab) — client-side ============
  const filteredCobrancas = useMemo(() => {
    if (!cobrancas) return [];
    let result = cobrancas;

    if (filters.status !== 'todos') {
      result = result.filter(c => c.status === filters.status);
    }

    if (filters.busca) {
      const busca = filters.busca.toLowerCase();
      result = result.filter(c =>
        c.associado?.nome?.toLowerCase().includes(busca) ||
        c.associado?.cpf?.includes(busca)
      );
    }

    if (activeTab !== 'todas') {
      result = result.filter(c => c.status === activeTab);
    }

    return result;
  }, [cobrancas, filters.busca, filters.status, activeTab]);

  // Paginação
  const totalPages = Math.ceil(filteredCobrancas.length / itemsPerPage);
  const paginatedCobrancas = filteredCobrancas.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  // Contadores das tabs
  const tabCounts = useMemo(() => {
    if (!cobrancas) return { todas: 0, pendente: 0, pago: 0, vencido: 0, cancelado: 0 };
    return {
      todas: cobrancas.length,
      pendente: cobrancas.filter(c => c.status === 'pendente').length,
      pago: cobrancas.filter(c => c.status === 'pago').length,
      vencido: cobrancas.filter(c => c.status === 'vencido').length,
      cancelado: cobrancas.filter(c => c.status === 'cancelado').length,
    };
  }, [cobrancas]);

  // Seleção em lote
  const handleSelectAll = () => {
    if (selectedIds.size === paginatedCobrancas.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(paginatedCobrancas.map(c => c.id)));
    }
  };

  const handleSelectItem = (id: string) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) newSelected.delete(id); else newSelected.add(id);
    setSelectedIds(newSelected);
  };

  const clearSelection = () => setSelectedIds(new Set());

  // Mutation: cancelar cobrança (apenas Asaas — SGA é read-only no nosso lado)
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
      queryClient.invalidateQueries({ queryKey: ['cobrancas-lista-unificada'] });
    },
    onError: (error: Error) => {
      toast.error(`Erro ao cancelar: ${error.message}`);
    },
  });

  // ============ Envios WhatsApp ============
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

  const handleEnviarBoletosLote = async () => {
    const selecionadas = paginatedCobrancas.filter(c => selectedIds.has(c.id));
    const comBoleto = selecionadas.filter(c => c.boleto_url && (c.associado?.whatsapp || c.associado?.telefone));
    if (comBoleto.length === 0) { toast.error('Nenhuma cobrança com boleto e telefone disponíveis'); return; }

    setEnviandoLote(true);
    let enviados = 0; let erros = 0;
    for (const cobranca of comBoleto) {
      try {
        const telefone = cobranca.associado!.whatsapp || cobranca.associado!.telefone!;
        const valor = formatCurrency(cobranca.valor);
        const vencimento = cobranca.data_vencimento
          ? format(parseISO(cobranca.data_vencimento), 'dd/MM/yyyy', { locale: ptBR })
          : '';
        await supabase.functions.invoke('whatsapp-send-media', {
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
        enviados++;
        await new Promise(r => setTimeout(r, 1000));
      } catch { erros++; }
    }
    setEnviandoLote(false);
    toast.success(`${enviados} boleto(s) enviado(s)${erros > 0 ? `, ${erros} erro(s)` : ''}`);
    clearSelection();
  };

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
    if (cobranca.boleto_url) mensagem += `\n📄 Boleto: ${cobranca.boleto_url}\n`;
    if (cobranca.pix_copia_cola) mensagem += `\n📱 PIX Copia e Cola:\n${cobranca.pix_copia_cola}\n`;

    window.open(`https://wa.me/55${telefoneFormatado}?text=${encodeURIComponent(mensagem)}`, '_blank');
  };

  const handleEnviarWhatsAppLote = () => {
    paginatedCobrancas.filter(c => selectedIds.has(c.id)).forEach(handleEnviarWhatsApp);
    clearSelection();
  };

  const handleEnviarEmailLote = () => {
    toast.info(`Enviando e-mail para ${selectedIds.size} cobrança(s)...`);
    clearSelection();
  };

  const handleReemitirLote = () => {
    toast.info(`Reemitindo ${selectedIds.size} cobrança(s)...`);
    clearSelection();
  };

  const clearFilters = () => {
    setFilters({
      status: 'todos',
      tipo: 'todos',
      origem: 'todas',
      mes: new Date().getMonth() + 1,
      ano: new Date().getFullYear(),
      busca: '',
    });
    setActiveTab('todas');
    setCurrentPage(1);
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

  const handleExportar = () => {
    if (!filteredCobrancas.length) { toast.error('Nenhuma cobrança para exportar'); return; }
    const headers = 'Origem,Nome,CPF,Tipo,Valor,Vencimento,Status\n';
    const rows = filteredCobrancas.map(c =>
      `"${c.origem}","${c.associado?.nome || ''}","${c.associado?.cpf || ''}","${c.tipo}","${c.valor}","${c.data_vencimento || ''}","${c.status}"`
    ).join('\n');
    const blob = new Blob([headers + rows], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `cobrancas_${filters.mes}_${filters.ano}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Cobranças exportadas!');
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Cobranças</h1>
          <p className="text-muted-foreground">Gerencie cobranças do Asaas e do histórico SGA Hinova</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {(isDiretor || isAdminMaster || isDesenvolvedor) && <SgaBackfillFinanceiroDialog />}
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
            <p className="text-2xl font-bold">{kpis.total}</p>
            <p className="text-xs text-muted-foreground">cobranças</p>
          </CardContent>
        </Card>
        <Card className="border-green-200 dark:border-green-800">
          <CardContent className="p-4">
            <p className="text-sm text-green-600 dark:text-green-400">Pagas</p>
            <p className="text-2xl font-bold text-green-600 dark:text-green-400">{kpis.qtdPagas}</p>
            <p className="text-xs text-green-600/80 dark:text-green-400/80">{formatCurrency(kpis.valorPagas)}</p>
          </CardContent>
        </Card>
        <Card className="border-yellow-200 dark:border-yellow-800">
          <CardContent className="p-4">
            <p className="text-sm text-yellow-600 dark:text-yellow-400">Pendentes</p>
            <p className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">{kpis.qtdPendentes}</p>
            <p className="text-xs text-yellow-600/80 dark:text-yellow-400/80">{formatCurrency(kpis.valorPendentes)}</p>
          </CardContent>
        </Card>
        <Card className="border-red-200 dark:border-red-800">
          <CardContent className="p-4">
            <p className="text-sm text-destructive">Vencidas</p>
            <p className="text-2xl font-bold text-destructive">{kpis.qtdVencidas}</p>
            <p className="text-xs text-destructive/80">{formatCurrency(kpis.valorVencidas)}</p>
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
                  placeholder="Buscar por nome ou CPF..."
                  value={filters.busca}
                  onChange={(e) => setFilters(prev => ({ ...prev, busca: e.target.value }))}
                  className="pl-9"
                />
              </div>
            </div>
            <Select value={filters.origem} onValueChange={(value: any) => setFilters(prev => ({ ...prev, origem: value }))}>
              <SelectTrigger className="w-[160px]"><SelectValue placeholder="Origem" /></SelectTrigger>
              <SelectContent>
                {origemOptions.map(opt => <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={filters.status} onValueChange={(value) => setFilters(prev => ({ ...prev, status: value }))}>
              <SelectTrigger className="w-[160px]"><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent>
                {statusOptions.map(opt => <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={filters.tipo} onValueChange={(value) => setFilters(prev => ({ ...prev, tipo: value }))}>
              <SelectTrigger className="w-[160px]"><SelectValue placeholder="Tipo" /></SelectTrigger>
              <SelectContent>
                {tipoOptions.map(opt => <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={String(filters.mes)} onValueChange={(value) => setFilters(prev => ({ ...prev, mes: Number(value) }))}>
              <SelectTrigger className="w-[140px]"><SelectValue placeholder="Mês" /></SelectTrigger>
              <SelectContent>
                {meses.map(m => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={String(filters.ano)} onValueChange={(value) => setFilters(prev => ({ ...prev, ano: Number(value) }))}>
              <SelectTrigger className="w-[100px]"><SelectValue placeholder="Ano" /></SelectTrigger>
              <SelectContent>
                {getAnos().map(a => <SelectItem key={a.value} value={a.value}>{a.label}</SelectItem>)}
              </SelectContent>
            </Select>
            <Button variant="ghost" size="sm" onClick={clearFilters}>
              <X className="mr-1 h-4 w-4" />Limpar
            </Button>
          </div>
        </CardContent>
      </Card>

      <Tabs value={activeTab} onValueChange={(v) => { setActiveTab(v); setCurrentPage(1); }}>
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
                    checked={paginatedCobrancas.length > 0 && selectedIds.size === paginatedCobrancas.length}
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
              {isLoading ? (
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
              ) : paginatedCobrancas.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                    Nenhuma cobrança encontrada
                  </TableCell>
                </TableRow>
              ) : (
                paginatedCobrancas.map((cobranca) => (
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
                        <p className="text-xs text-muted-foreground">
                          {formatCpfParcial(cobranca.associado?.cpf || '')}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={cobranca.origem === 'asaas' ? 'default' : 'secondary'}>
                        {cobranca.origem === 'asaas' ? 'Asaas' : 'SGA'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {tipoConfig[cobranca.tipo]?.label || cobranca.tipo}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {cobranca.competencia || '-'}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {formatCurrency(cobranca.valor)}
                    </TableCell>
                    <TableCell>
                      {cobranca.data_vencimento
                        ? format(parseISO(cobranca.data_vencimento), 'dd/MM/yyyy', { locale: ptBR })
                        : '-'}
                    </TableCell>
                    <TableCell>
                      <Badge variant={statusConfig[cobranca.status].variant}>
                        {statusConfig[cobranca.status].label}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => navigate(`/financeiro/cobrancas/${cobranca.id}`)}>
                            <Eye className="mr-2 h-4 w-4" />Ver detalhes
                          </DropdownMenuItem>
                          {!['pago', 'cancelado'].includes(cobranca.status) && (
                            <>
                              <DropdownMenuItem onClick={() => {
                                setCobrancaSelecionada(cobranca);
                                setModalPagamento(true);
                              }}>
                                <DollarSign className="mr-2 h-4 w-4" />Registrar Pagamento
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleEnviarWhatsApp(cobranca)}>
                                <MessageSquare className="mr-2 h-4 w-4" />WhatsApp (link)
                              </DropdownMenuItem>
                              {cobranca.boleto_url && (
                                <DropdownMenuItem
                                  onClick={() => handleEnviarBoletoPDF(cobranca)}
                                  disabled={enviandoPDF === cobranca.id}
                                >
                                  {enviandoPDF === cobranca.id ? (
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                  ) : (
                                    <FileText className="mr-2 h-4 w-4" />
                                  )}
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

      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Mostrando {(currentPage - 1) * itemsPerPage + 1} a{' '}
            {Math.min(currentPage * itemsPerPage, filteredCobrancas.length)} de{' '}
            {filteredCobrancas.length} cobranças
          </p>
          <div className="flex gap-1">
            <Button variant="outline" size="sm" onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))} disabled={currentPage === 1}>
              Anterior
            </Button>
            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              const page = i + 1;
              return (
                <Button
                  key={page}
                  variant={currentPage === page ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setCurrentPage(page)}
                >
                  {page}
                </Button>
              );
            })}
            <Button variant="outline" size="sm" onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))} disabled={currentPage === totalPages}>
              Próximo
            </Button>
          </div>
        </div>
      )}

      <NovaCobrancaModal open={modalNovaCobranca} onClose={() => setModalNovaCobranca(false)} />
      <RegistrarPagamentoModal
        open={modalPagamento}
        onClose={() => { setModalPagamento(false); setCobrancaSelecionada(null); }}
        cobranca={cobrancaSelecionada}
      />

      <BatchActionsBar
        selectedCount={selectedIds.size}
        onClear={clearSelection}
        actions={[
          {
            label: enviandoLote ? 'Enviando...' : 'Enviar Boletos PDF',
            icon: enviandoLote ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />,
            onClick: handleEnviarBoletosLote,
            disabled: enviandoLote,
          },
          { label: 'WhatsApp', icon: <MessageSquare className="h-4 w-4" />, onClick: handleEnviarWhatsAppLote },
          { label: 'E-mail', icon: <Mail className="h-4 w-4" />, onClick: handleEnviarEmailLote },
          { label: 'Reemitir', icon: <RefreshCw className="h-4 w-4" />, onClick: handleReemitirLote },
        ]}
      />
    </div>
  );
}
