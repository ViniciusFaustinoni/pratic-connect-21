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
import { format, isToday, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';
import { NovaCobrancaModal } from '@/components/financeiro/NovaCobrancaModal';
import { RegistrarPagamentoModal } from '@/components/financeiro/RegistrarPagamentoModal';
import { BatchActionsBar } from '@/components/financeiro/BatchActionsBar';

const statusConfig: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  'PENDING': { label: 'Pendente', variant: 'secondary' },
  'RECEIVED': { label: 'Pago', variant: 'default' },
  'CONFIRMED': { label: 'Confirmado', variant: 'default' },
  'OVERDUE': { label: 'Vencido', variant: 'destructive' },
  'CANCELED': { label: 'Cancelado', variant: 'outline' },
  'pendente': { label: 'Pendente', variant: 'secondary' },
  'pago': { label: 'Pago', variant: 'default' },
  'vencido': { label: 'Vencido', variant: 'destructive' },
  'cancelado': { label: 'Cancelado', variant: 'outline' },
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
  return [
    { value: String(anoAtual), label: String(anoAtual) },
    { value: String(anoAtual - 1), label: String(anoAtual - 1) },
    { value: String(anoAtual - 2), label: String(anoAtual - 2) },
  ];
};

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

const formatCpfParcial = (cpf: string) => {
  if (!cpf) return '';
  const clean = cpf.replace(/\D/g, '');
  if (clean.length !== 11) return cpf;
  return `${clean.slice(0, 3)}.***.**${clean.slice(8, 9)}-${clean.slice(9)}`;
};

const mapStatusToAsaas = (status: string): string[] => {
  const map: Record<string, string[]> = {
    'pendente': ['PENDING', 'pendente'],
    'pago': ['RECEIVED', 'CONFIRMED', 'pago'],
    'vencido': ['OVERDUE', 'vencido'],
    'cancelado': ['CANCELED', 'cancelado'],
  };
  return map[status] || [status];
};

export default function CobrancasList() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  
  const [filters, setFilters] = useState({
    status: 'todos',
    tipo: 'todos',
    mes: new Date().getMonth() + 1,
    ano: new Date().getFullYear(),
    busca: '',
  });
  const [activeTab, setActiveTab] = useState('todas');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 25;

  // Estado para seleção em lote
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Estados dos modais
  const [modalNovaCobranca, setModalNovaCobranca] = useState(false);
  const [modalPagamento, setModalPagamento] = useState(false);
  const [cobrancaSelecionada, setCobrancaSelecionada] = useState<any>(null);

  // Funções de seleção em lote
  const handleSelectAll = () => {
    if (selectedIds.size === paginatedCobrancas.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(paginatedCobrancas.map(c => c.id)));
    }
  };

  const handleSelectItem = (id: string) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  };

  const clearSelection = () => setSelectedIds(new Set());

  // Estado para envio em lote
  const [enviandoLote, setEnviandoLote] = useState(false);
  const [enviandoPDF, setEnviandoPDF] = useState<string | null>(null);

  // Enviar boleto PDF via Evolution API
  const handleEnviarBoletoPDF = async (cobranca: any) => {
    const telefone = cobranca.associado?.whatsapp || cobranca.associado?.telefone;
    if (!telefone) {
      toast.error('Associado sem telefone cadastrado');
      return;
    }
    if (!cobranca.boleto_url) {
      toast.error('Boleto não disponível para envio');
      return;
    }

    setEnviandoPDF(cobranca.id);
    try {
      const valor = formatCurrency(Number(cobranca.valor));
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
      console.error('Erro ao enviar boleto PDF:', err);
      toast.error(`Erro ao enviar: ${err.message}`);
    } finally {
      setEnviandoPDF(null);
    }
  };

  // Ações em lote - Enviar boletos PDF via Evolution API
  const handleEnviarBoletosLote = async () => {
    const selecionadas = paginatedCobrancas.filter(c => selectedIds.has(c.id));
    const comBoleto = selecionadas.filter(c => c.boleto_url && (c.associado?.whatsapp || c.associado?.telefone));
    
    if (comBoleto.length === 0) {
      toast.error('Nenhuma cobrança com boleto e telefone disponíveis');
      return;
    }

    setEnviandoLote(true);
    let enviados = 0;
    let erros = 0;

    for (const cobranca of comBoleto) {
      try {
        const telefone = cobranca.associado?.whatsapp || cobranca.associado?.telefone;
        const valor = formatCurrency(Number(cobranca.valor));
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
        // Delay entre envios para evitar bloqueio (1 segundo)
        await new Promise(r => setTimeout(r, 1000));
      } catch {
        erros++;
      }
    }

    setEnviandoLote(false);
    toast.success(`${enviados} boleto(s) enviado(s)${erros > 0 ? `, ${erros} erro(s)` : ''}`);
    clearSelection();
  };

  const handleEnviarWhatsAppLote = () => {
    const selecionadas = paginatedCobrancas.filter(c => selectedIds.has(c.id));
    selecionadas.forEach(cobranca => {
      handleEnviarWhatsApp(cobranca);
    });
    clearSelection();
  };

  const handleEnviarEmailLote = () => {
    toast.info(`Enviando e-mail para ${selectedIds.size} cobrança(s)...`);
    // TODO: Implementar lógica de envio de email
    clearSelection();
  };

  const handleReemitirLote = () => {
    toast.info(`Reemitindo ${selectedIds.size} cobrança(s)...`);
    // TODO: Implementar lógica de reemissão
    clearSelection();
  };

  // Mutation para cancelar cobrança
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
      queryClient.invalidateQueries({ queryKey: ['cobrancas-lista'] });
      queryClient.invalidateQueries({ queryKey: ['cobrancas-kpis'] });
    },
    onError: (error: Error) => {
      toast.error(`Erro ao cancelar: ${error.message}`);
    },
  });

  // Query principal de cobranças
  const { data: cobrancas, isLoading } = useQuery({
    queryKey: ['cobrancas-lista', filters],
    queryFn: async () => {
      const competencia = `${String(filters.mes).padStart(2, '0')}/${filters.ano}`;
      
      let query = supabase
        .from('asaas_cobrancas')
        .select(`
          *,
          associado:associados(id, nome, cpf, telefone, whatsapp)
        `)
        .order('data_vencimento', { ascending: false });

      // Filtro de status
      if (filters.status !== 'todos') {
        const statusList = mapStatusToAsaas(filters.status);
        query = query.in('status', statusList);
      }

      // Filtro de tipo
      if (filters.tipo !== 'todos') {
        query = query.ilike('tipo', `%${filters.tipo}%`);
      }

      // Filtro de competência
      query = query.eq('competencia', competencia);

      const { data, error } = await query.limit(500);
      if (error) throw error;
      return data;
    },
  });

  // Query para KPIs
  const { data: kpis } = useQuery({
    queryKey: ['cobrancas-kpis', filters.mes, filters.ano],
    queryFn: async () => {
      const competencia = `${String(filters.mes).padStart(2, '0')}/${filters.ano}`;

      const { data } = await supabase
        .from('asaas_cobrancas')
        .select('valor, pagamento_valor, status')
        .eq('competencia', competencia);

      const total = data?.length || 0;
      const pagas = data?.filter(c => ['RECEIVED', 'CONFIRMED', 'pago'].includes(c.status)) || [];
      const pendentes = data?.filter(c => ['PENDING', 'pendente'].includes(c.status)) || [];
      const vencidas = data?.filter(c => ['OVERDUE', 'vencido'].includes(c.status)) || [];

      return {
        total,
        qtdPagas: pagas.length,
        valorPagas: pagas.reduce((acc, c) => acc + Number(c.pagamento_valor || c.valor || 0), 0),
        qtdPendentes: pendentes.length,
        valorPendentes: pendentes.reduce((acc, c) => acc + Number(c.valor || 0), 0),
        qtdVencidas: vencidas.length,
        valorVencidas: vencidas.reduce((acc, c) => acc + Number(c.valor || 0), 0),
      };
    },
  });

  // Filtragem por busca e tab (client-side)
  const filteredCobrancas = useMemo(() => {
    if (!cobrancas) return [];
    
    let result = cobrancas;

    // Filtro por busca
    if (filters.busca) {
      const busca = filters.busca.toLowerCase();
      result = result.filter(c => 
        c.associado?.nome?.toLowerCase().includes(busca) ||
        c.associado?.cpf?.includes(busca)
      );
    }

    // Filtro por tab
    if (activeTab !== 'todas') {
      const statusList = mapStatusToAsaas(activeTab);
      result = result.filter(c => statusList.includes(c.status));
    }

    return result;
  }, [cobrancas, filters.busca, activeTab]);

  // Paginação
  const totalPages = Math.ceil(filteredCobrancas.length / itemsPerPage);
  const paginatedCobrancas = filteredCobrancas.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  // Contadores para tabs
  const tabCounts = useMemo(() => {
    if (!cobrancas) return { todas: 0, pendente: 0, pago: 0, vencido: 0, cancelado: 0 };
    return {
      todas: cobrancas.length,
      pendente: cobrancas.filter(c => ['PENDING', 'pendente'].includes(c.status)).length,
      pago: cobrancas.filter(c => ['RECEIVED', 'CONFIRMED', 'pago'].includes(c.status)).length,
      vencido: cobrancas.filter(c => ['OVERDUE', 'vencido'].includes(c.status)).length,
      cancelado: cobrancas.filter(c => ['CANCELED', 'cancelado'].includes(c.status)).length,
    };
  }, [cobrancas]);

  const clearFilters = () => {
    setFilters({
      status: 'todos',
      tipo: 'todos',
      mes: new Date().getMonth() + 1,
      ano: new Date().getFullYear(),
      busca: '',
    });
    setActiveTab('todas');
    setCurrentPage(1);
  };

  const isVencendoHoje = (dataVencimento: string) => {
    if (!dataVencimento) return false;
    return isToday(parseISO(dataVencimento));
  };

  const isVencido = (status: string) => {
    return ['OVERDUE', 'vencido'].includes(status);
  };

  const getRowClass = (cobranca: any) => {
    if (isVencido(cobranca.status)) return 'bg-destructive/5';
    if (isVencendoHoje(cobranca.data_vencimento)) return 'bg-yellow-50 dark:bg-yellow-900/10';
    return '';
  };

  const handleEnviarWhatsApp = (cobranca: any) => {
    const telefone = cobranca.associado?.whatsapp || cobranca.associado?.telefone;
    if (!telefone) {
      toast.error('Associado sem telefone cadastrado');
      return;
    }
    
    const telefoneFormatado = telefone.replace(/\D/g, '');
    const valor = formatCurrency(Number(cobranca.valor));
    const vencimento = cobranca.data_vencimento 
      ? format(parseISO(cobranca.data_vencimento), 'dd/MM/yyyy', { locale: ptBR })
      : '';
    
    let mensagem = `Olá ${cobranca.associado?.nome || ''}! 👋\n\n`;
    mensagem += `Segue sua cobrança:\n`;
    mensagem += `💰 Valor: ${valor}\n`;
    mensagem += `📅 Vencimento: ${vencimento}\n`;
    
    if (cobranca.boleto_url) {
      mensagem += `\n📄 Boleto: ${cobranca.boleto_url}\n`;
    }
    
    if (cobranca.pix_copia_cola) {
      mensagem += `\n📱 PIX Copia e Cola:\n${cobranca.pix_copia_cola}\n`;
    }
    
    const url = `https://wa.me/55${telefoneFormatado}?text=${encodeURIComponent(mensagem)}`;
    window.open(url, '_blank');
  };

  const handleExportar = () => {
    if (!filteredCobrancas.length) {
      toast.error('Nenhuma cobrança para exportar');
      return;
    }

    const headers = 'Nome,CPF,Tipo,Valor,Vencimento,Status\n';
    const rows = filteredCobrancas.map(c => 
      `"${c.associado?.nome || ''}","${c.associado?.cpf || ''}","${c.tipo}","${c.valor}","${c.data_vencimento}","${c.status}"`
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
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Cobranças</h1>
          <p className="text-muted-foreground">
            Gerencie todas as cobranças da associação
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleExportar}>
            <Download className="mr-2 h-4 w-4" />
            Exportar
          </Button>
          <Button onClick={() => setModalNovaCobranca(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Nova Cobrança
          </Button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Total</p>
            <p className="text-2xl font-bold">{kpis?.total || 0}</p>
            <p className="text-xs text-muted-foreground">cobranças</p>
          </CardContent>
        </Card>
        <Card className="border-green-200 dark:border-green-800">
          <CardContent className="p-4">
            <p className="text-sm text-green-600 dark:text-green-400">Pagas</p>
            <p className="text-2xl font-bold text-green-600 dark:text-green-400">
              {kpis?.qtdPagas || 0}
            </p>
            <p className="text-xs text-green-600/80 dark:text-green-400/80">
              {formatCurrency(kpis?.valorPagas || 0)}
            </p>
          </CardContent>
        </Card>
        <Card className="border-yellow-200 dark:border-yellow-800">
          <CardContent className="p-4">
            <p className="text-sm text-yellow-600 dark:text-yellow-400">Pendentes</p>
            <p className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">
              {kpis?.qtdPendentes || 0}
            </p>
            <p className="text-xs text-yellow-600/80 dark:text-yellow-400/80">
              {formatCurrency(kpis?.valorPendentes || 0)}
            </p>
          </CardContent>
        </Card>
        <Card className="border-red-200 dark:border-red-800">
          <CardContent className="p-4">
            <p className="text-sm text-destructive">Vencidas</p>
            <p className="text-2xl font-bold text-destructive">
              {kpis?.qtdVencidas || 0}
            </p>
            <p className="text-xs text-destructive/80">
              {formatCurrency(kpis?.valorVencidas || 0)}
            </p>
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
            <Select
              value={filters.status}
              onValueChange={(value) => setFilters(prev => ({ ...prev, status: value }))}
            >
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                {statusOptions.map(opt => (
                  <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={filters.tipo}
              onValueChange={(value) => setFilters(prev => ({ ...prev, tipo: value }))}
            >
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="Tipo" />
              </SelectTrigger>
              <SelectContent>
                {tipoOptions.map(opt => (
                  <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={String(filters.mes)}
              onValueChange={(value) => setFilters(prev => ({ ...prev, mes: Number(value) }))}
            >
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="Mês" />
              </SelectTrigger>
              <SelectContent>
                {meses.map(m => (
                  <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={String(filters.ano)}
              onValueChange={(value) => setFilters(prev => ({ ...prev, ano: Number(value) }))}
            >
              <SelectTrigger className="w-[100px]">
                <SelectValue placeholder="Ano" />
              </SelectTrigger>
              <SelectContent>
                {getAnos().map(a => (
                  <SelectItem key={a.value} value={a.value}>{a.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="ghost" size="sm" onClick={clearFilters}>
              <X className="mr-1 h-4 w-4" />
              Limpar
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Tabs de Status */}
      <Tabs value={activeTab} onValueChange={(v) => { setActiveTab(v); setCurrentPage(1); }}>
        <TabsList>
          <TabsTrigger value="todas">Todas ({tabCounts.todas})</TabsTrigger>
          <TabsTrigger value="pendente">Pendentes ({tabCounts.pendente})</TabsTrigger>
          <TabsTrigger value="pago">Pagas ({tabCounts.pago})</TabsTrigger>
          <TabsTrigger value="vencido">Vencidas ({tabCounts.vencido})</TabsTrigger>
          <TabsTrigger value="cancelado">Canceladas ({tabCounts.cancelado})</TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Tabela */}
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
                  <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                    Nenhuma cobrança encontrada
                  </TableCell>
                </TableRow>
              ) : (
                paginatedCobrancas.map((cobranca) => (
                  <TableRow key={cobranca.id} className={getRowClass(cobranca)}>
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
                      <Badge variant="outline">
                        {tipoConfig[cobranca.tipo]?.label || cobranca.tipo}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {cobranca.competencia || '-'}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {formatCurrency(Number(cobranca.valor) || 0)}
                    </TableCell>
                    <TableCell>
                      {cobranca.data_vencimento
                        ? format(parseISO(cobranca.data_vencimento), 'dd/MM/yyyy', { locale: ptBR })
                        : '-'}
                    </TableCell>
                    <TableCell>
                      <Badge variant={statusConfig[cobranca.status]?.variant || 'outline'}>
                        {statusConfig[cobranca.status]?.label || cobranca.status}
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
                            <Eye className="mr-2 h-4 w-4" />
                            Ver detalhes
                          </DropdownMenuItem>
                          {!['RECEIVED', 'CONFIRMED', 'pago', 'CANCELED', 'cancelado'].includes(cobranca.status) && (
                            <>
                              <DropdownMenuItem onClick={() => {
                                setCobrancaSelecionada(cobranca);
                                setModalPagamento(true);
                              }}>
                                <DollarSign className="mr-2 h-4 w-4" />
                                Registrar Pagamento
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleEnviarWhatsApp(cobranca)}>
                                <MessageSquare className="mr-2 h-4 w-4" />
                                WhatsApp (link)
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
                              <DropdownMenuSeparator />
                              <DropdownMenuItem 
                                className="text-destructive"
                                onClick={() => {
                                  if (confirm('Tem certeza que deseja cancelar esta cobrança?')) {
                                    cancelarCobranca.mutate(cobranca.asaas_id);
                                  }
                                }}
                              >
                                <X className="mr-2 h-4 w-4" />
                                Cancelar
                              </DropdownMenuItem>
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

      {/* Paginação */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Mostrando {(currentPage - 1) * itemsPerPage + 1} a{' '}
            {Math.min(currentPage * itemsPerPage, filteredCobrancas.length)} de{' '}
            {filteredCobrancas.length} cobranças
          </p>
          <div className="flex gap-1">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
              disabled={currentPage === 1}
            >
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
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
              disabled={currentPage === totalPages}
            >
              Próximo
            </Button>
          </div>
        </div>
      )}

      {/* Modais */}
      <NovaCobrancaModal 
        open={modalNovaCobranca} 
        onClose={() => setModalNovaCobranca(false)} 
      />
      <RegistrarPagamentoModal 
        open={modalPagamento} 
        onClose={() => {
          setModalPagamento(false);
          setCobrancaSelecionada(null);
        }}
        cobranca={cobrancaSelecionada}
      />

      {/* Barra de Ações em Lote */}
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
          {
            label: 'WhatsApp',
            icon: <MessageSquare className="h-4 w-4" />,
            onClick: handleEnviarWhatsAppLote,
          },
          {
            label: 'E-mail',
            icon: <Mail className="h-4 w-4" />,
            onClick: handleEnviarEmailLote,
          },
          {
            label: 'Reemitir',
            icon: <RefreshCw className="h-4 w-4" />,
            onClick: handleReemitirLote,
          },
        ]}
      />
    </div>
  );
}
