import { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Plus, Search, FileText, Send, Check, Loader2, CheckCircle, TrendingUp, Calendar as CalendarIcon, User, RefreshCw, CalendarDays, Link, ListChecks, FileUp, PenTool, CreditCard, MapPin, Clock, Trophy, Trash2, AlertTriangle } from 'lucide-react';
import { formatDistanceToNow, format, isSameDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { useCotacoes, useUpdateCotacao, useDuplicarCotacao, useExcluirCotacao, type CotacaoWithRelations } from '@/hooks/useCotacoes';
import { useGerarContrato } from '@/hooks/useContratos';
import { useAuth } from '@/contexts/AuthContext';
import { usePermissions } from '@/hooks/usePermissions';
import { useVendedores } from '@/hooks/useVendedores';
import { PermissionGate } from '@/components/PermissionGate';
import { CotacaoFormDialog } from '@/components/cotacoes/CotacaoFormDialog';
import { ContratoWizard } from '@/components/contratos/ContratoWizard';
import { EnviarEmailModal } from '@/components/cotacoes/EnviarEmailModal';
import { VincularLeadModal } from '@/components/cotacoes/VincularLeadModal';
import { gerarPdfCotacao, gerarPdfCotacaoComparativa, type PlanoParaPdf, type CotacaoComparativaParaPdf } from '@/lib/gerarPdfCotacao';
import { CotacoesTable, type CotacoesTablePermissions } from '@/components/cotacoes/CotacoesTable';
import { CotacaoDetalhesModal } from '@/components/cotacoes/CotacaoDetalhesModal';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { cn } from '@/lib/utils';
import { useCotacoesRealtime } from '@/hooks/useCotacoesRealtime';

// Categorização dinâmica — fallback por termos quando benefits.category não está disponível
const categorizarPorTermo = (cobLower: string): 'cobertura' | 'assistencia' | 'extra' => {
  const termos_assistencia = ['assistência', '24h', 'rastreador', 'monitoramento', 'reboque', 'guincho', 'chaveiro', 'pane', 'troca de pneu'];
  const termos_extra = ['kit gás', 'carro reserva', 'clube gás', '100% fipe', 'fipe app', 'app', 'proteção de vidros', 'cobertura de vidros'];
  
  if (termos_assistencia.some(t => cobLower.includes(t))) return 'assistencia';
  if (termos_extra.some(t => cobLower.includes(t))) return 'extra';
  return 'cobertura';
};

// Função para categorizar coberturas
const categorizarBeneficios = (coberturas: string[]) => {
  const resultado = {
    coberturas: [] as string[],
    assistencia: [] as string[],
    extras: [] as string[],
  };
  
  coberturas.forEach(cob => {
    const cobLower = cob.toLowerCase();
    let categoriaEncontrada = categorizarPorTermo(cobLower);
    
    if (categoriaEncontrada === 'cobertura') {
      resultado.coberturas.push(cob);
    } else if (categoriaEncontrada === 'assistencia') {
      resultado.assistencia.push(cob);
    } else {
      resultado.extras.push(cob);
    }
  });
  
  return resultado;
};

export default function Cotacoes() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [showCotacaoForm, setShowCotacaoForm] = useState(false);
  const [showContratoWizard, setShowContratoWizard] = useState(false);
  const [selectedCotacaoId, setSelectedCotacaoId] = useState<string>('');
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [selectedCotacaoEmail, setSelectedCotacaoEmail] = useState<CotacaoWithRelations | null>(null);
  const [leadIdFromUrl, setLeadIdFromUrl] = useState<string | null>(null);
  const [showVincularModal, setShowVincularModal] = useState(false);
  const [cotacaoParaVincular, setCotacaoParaVincular] = useState<CotacaoWithRelations | null>(null);
  const [cotacaoParaExcluir, setCotacaoParaExcluir] = useState<string | null>(null);
  const [mesFilter, setMesFilter] = useState<string>('all');
  const [cotacaoParaDuplicar, setCotacaoParaDuplicar] = useState<CotacaoWithRelations | null>(null);
  const [copiandoWhatsApp, setCopiandoWhatsApp] = useState<string | null>(null);
  
  // Filtros
  const [dataFilter, setDataFilter] = useState<Date | undefined>(undefined);
  const [consultorFilter, setConsultorFilter] = useState<string>('all');
  
  // Modal de detalhes
  const [showDetalhesModal, setShowDetalhesModal] = useState(false);
  const [cotacaoSelecionada, setCotacaoSelecionada] = useState<CotacaoWithRelations | null>(null);

  const permissions = usePermissions();
  const { profile, user } = useAuth();
  
  const { data: vendedores } = useVendedores();
  
  const { data: cotacoes, isLoading } = useCotacoes({
    vendedorId: permissions.userId,
    viewScope: permissions.cotacao.viewScope,
  });
  
  const updateCotacao = useUpdateCotacao();
  const gerarContrato = useGerarContrato();
  const duplicarCotacao = useDuplicarCotacao();
  const excluirCotacao = useExcluirCotacao();
  const queryClient = useQueryClient();
  
  useCotacoesRealtime();

  useEffect(() => {
    const leadParam = searchParams.get('lead');
    const novoParam = searchParams.get('novo');
    
    if (leadParam) {
      setLeadIdFromUrl(leadParam);
      setShowCotacaoForm(true);
      searchParams.delete('lead');
      setSearchParams(searchParams, { replace: true });
    } else if (novoParam === 'true') {
      setShowCotacaoForm(true);
      searchParams.delete('novo');
      setSearchParams(searchParams, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  const formatRelativeTime = (dateStr: string) => {
    return formatDistanceToNow(new Date(dateStr), { addSuffix: true, locale: ptBR });
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  // Filtrar cotações
  const filteredCotacoes = useMemo(() => {
    return (cotacoes || []).filter((cotacao) => {
      const searchLower = search.toLowerCase();
      const matchesSearch =
        cotacao.numero.toLowerCase().includes(searchLower) ||
        (cotacao.leads?.nome?.toLowerCase().includes(searchLower) ?? false) ||
        (cotacao.veiculo_placa?.toLowerCase().includes(searchLower) ?? false) ||
        (cotacao.veiculo_marca?.toLowerCase().includes(searchLower) ?? false) ||
        (cotacao.veiculo_modelo?.toLowerCase().includes(searchLower) ?? false);
      const matchesStatus = statusFilter === 'all' || cotacao.status === statusFilter;
      
      let matchesMes = true;
      if (mesFilter !== 'all') {
        const cotacaoDate = new Date(cotacao.created_at);
        const [year, month] = mesFilter.split('-').map(Number);
        matchesMes = cotacaoDate.getFullYear() === year && cotacaoDate.getMonth() === month - 1;
      }
      
      let matchesData = true;
      if (dataFilter) {
        const cotacaoDate = new Date(cotacao.created_at);
        matchesData = isSameDay(cotacaoDate, dataFilter);
      }
      
      let matchesConsultor = true;
      if (consultorFilter !== 'all') {
        matchesConsultor = cotacao.vendedor_id === consultorFilter;
      }
      
      return matchesSearch && matchesStatus && matchesMes && matchesData && matchesConsultor;
    });
  }, [cotacoes, search, statusFilter, mesFilter, dataFilter, consultorFilter]);

  // Ordenação inteligente
  const sortedCotacoes = useMemo(() => {
    return [...filteredCotacoes].sort((a, b) => {
      // Prioridade 1: Sem lead vinculado
      if (!a.lead_id && b.lead_id) return -1;
      if (a.lead_id && !b.lead_id) return 1;
      
      // Prioridade 2: Por status
      const statusOrder: Record<string, number> = {
        rascunho: 1,
        enviada: 2,
        visualizada: 3,
        aceita: 4,
        recusada: 5,
        expirada: 6,
      };
      const statusDiff = (statusOrder[a.status] || 99) - (statusOrder[b.status] || 99);
      if (statusDiff !== 0) return statusDiff;
      
      // Prioridade 3: Mais recentes primeiro
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });
  }, [filteredCotacoes]);
  
  const mesesDisponiveis = [...new Set((cotacoes || []).map(c => {
    const date = new Date(c.created_at);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
  }))].sort().reverse();
  
  const formatMesLabel = (mes: string) => {
    const [year, month] = mes.split('-');
    const date = new Date(parseInt(year), parseInt(month) - 1);
    return date.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
  };

  const handleRowClick = (cotacao: CotacaoWithRelations) => {
    setCotacaoSelecionada(cotacao);
    setShowDetalhesModal(true);
  };

  const handleDuplicar = (cotacao: CotacaoWithRelations) => {
    setCotacaoParaDuplicar(cotacao);
    setShowCotacaoForm(true);
  };

  const handleExcluir = (id: string) => {
    setCotacaoParaExcluir(id);
  };

  const confirmarExclusao = () => {
    if (cotacaoParaExcluir) {
      excluirCotacao.mutate(cotacaoParaExcluir);
      setCotacaoParaExcluir(null);
    }
  };

  const handleMarkAsEnviada = async (id: string, leadId?: string | null) => {
    try {
      await updateCotacao.mutateAsync({ id, status: 'enviada' });
      
      if (leadId) {
        await supabase
          .from('leads')
          .update({ etapa: 'cotacao_enviada', updated_at: new Date().toISOString() })
          .eq('id', leadId);
        
        queryClient.invalidateQueries({ queryKey: ['leads'] });
      }
      
      toast.success('Cotação marcada como enviada');
    } catch (error) {
      toast.error('Erro ao atualizar cotação');
    }
  };

  const handleBaixarPdf = async (cotacao: CotacaoWithRelations) => {
    try {
      const planosComparacao = cotacao.dados_extras?.planos_comparacao;
      
      if (planosComparacao && planosComparacao.length > 0) {
        const valorAdesao = cotacao.valor_adesao || 0;
        
        const planosParaPdf: PlanoParaPdf[] = planosComparacao.map(plano => ({
          nome: plano.nome,
          valorMensal: plano.valorMensal,
          valorAdesao: plano.valorAdesao ?? valorAdesao,
          coberturas: plano.coberturas || [],
          naoInclui: plano.naoInclui || [],
          coberturaFipe: plano.coberturaFipe || 100,
          cota: plano.cota || '',
          cotaPercentual: plano.cotaPercentual,
          cotaMinima: plano.cotaMinima,
          cotaDesagio: plano.cotaDesagio,
          cotaMinimaDesagio: plano.cotaMinimaDesagio,
          adicionalMensal: plano.adicionalMensal,
          anoMinimo: plano.anoMinimo,
          alertaDesagio: plano.alertaDesagio,
          coberturasRemovidas: plano.coberturasRemovidas,
        }));

        const cotacaoComparativa: CotacaoComparativaParaPdf = {
          numero: cotacao.numero,
          created_at: cotacao.created_at,
          validade_dias: cotacao.validade_dias,
          nome_solicitante: cotacao.leads?.nome || cotacao.nome_solicitante,
          telefone1_solicitante: cotacao.leads?.telefone || cotacao.telefone1_solicitante,
          email_solicitante: cotacao.leads?.email || cotacao.email_solicitante,
          veiculo_marca: cotacao.veiculo_marca,
          veiculo_modelo: cotacao.veiculo_modelo,
          veiculo_ano: cotacao.veiculo_ano,
          veiculo_placa: cotacao.veiculo_placa,
          valor_fipe: cotacao.valor_fipe,
          planosComparar: planosParaPdf,
        };

        await gerarPdfCotacaoComparativa(cotacaoComparativa);
      } else {
        await gerarPdfCotacao(cotacao);
      }
      
      toast.success('PDF gerado com sucesso!');
    } catch (error) {
      console.error('Erro ao gerar PDF:', error);
      toast.error('Erro ao gerar PDF');
    }
  };

  const handleOpenContratoWizard = (cotacaoId: string) => {
    setSelectedCotacaoId(cotacaoId);
    setShowContratoWizard(true);
    setShowDetalhesModal(false);
  };

  const handleContratoCreated = (contratoId: string) => {
    navigate('/vendas/contratos', { 
      state: { openContrato: contratoId } 
    });
  };

  const handleOpenEmailModal = (cotacao: CotacaoWithRelations) => {
    setSelectedCotacaoEmail(cotacao);
    setShowEmailModal(true);
  };

  // Função de fallback para gerar mensagem localmente
  const gerarMensagemFallback = (
    cotacao: CotacaoWithRelations,
    planos: Array<{ nome: string; valorMensal: number; coberturas: string[]; naoInclui?: string[] }>
  ): string => {
    const nomeCliente = cotacao.leads?.nome || cotacao.nome_solicitante || '';
    const primeiroNome = nomeCliente.split(' ')[0];
    const veiculo = `${cotacao.veiculo_marca} ${cotacao.veiculo_modelo} ${cotacao.veiculo_ano}`;
    
    let mensagem = `Olá${primeiroNome ? ` ${primeiroNome}` : ''}! 🚗\n\n`;
    mensagem += `Preparamos uma cotação especial para seu *${veiculo}*.\n\n`;
    mensagem += `💰 *Valor FIPE:* R$ ${cotacao.valor_fipe?.toLocaleString('pt-BR')}\n\n`;
    
    planos.forEach((plano, index) => {
      if (planos.length > 1) {
        mensagem += `━━━━━━━━━━━━━━━━━━\n`;
        mensagem += `📦 *OPÇÃO ${index + 1}: ${plano.nome}*\n`;
      } else {
        mensagem += `📦 *Plano:* ${plano.nome}\n`;
      }
      mensagem += `💵 *Mensalidade:* R$ ${plano.valorMensal.toFixed(2)}/mês\n\n`;
      
      const beneficios = categorizarBeneficios(plano.coberturas || []);
      
      if (beneficios.coberturas.length > 0) {
        mensagem += `🛡️ *Coberturas:*\n`;
        beneficios.coberturas.forEach(c => {
          mensagem += `✓ ${c}\n`;
        });
        mensagem += `\n`;
      }
      
      if (beneficios.assistencia.length > 0) {
        mensagem += `🚗 *Assistência 24h:*\n`;
        beneficios.assistencia.forEach(c => {
          mensagem += `✓ ${c}\n`;
        });
        mensagem += `\n`;
      }
      
      if (beneficios.extras.length > 0) {
        mensagem += `✨ *Benefícios Extras:*\n`;
        beneficios.extras.forEach(c => {
          mensagem += `✓ ${c}\n`;
        });
        mensagem += `\n`;
      }
      
      if (beneficios.coberturas.length === 0 && beneficios.assistencia.length === 0 && beneficios.extras.length === 0 && plano.coberturas && plano.coberturas.length > 0) {
        mensagem += `✅ *Benefícios inclusos:*\n`;
        plano.coberturas.forEach(c => {
          mensagem += `✓ ${c}\n`;
        });
        mensagem += `\n`;
      }
      
      if (plano.naoInclui && plano.naoInclui.length > 0) {
        mensagem += `❌ *Não inclui:*\n`;
        plano.naoInclui.forEach(n => {
          mensagem += `• ${n}\n`;
        });
        mensagem += `\n`;
      }
    });
    
    if (planos.length > 1) {
      mensagem += `━━━━━━━━━━━━━━━━━━\n\n`;
    }
    
    mensagem += `📝 *Taxa de Adesão:* R$ ${cotacao.valor_adesao?.toFixed(2)}\n`;
    mensagem += `⏰ Cotação válida por ${cotacao.validade_dias || 7} dias.\n\n`;
    
    if (cotacao.token_publico) {
      mensagem += `🔗 *Veja mais detalhes:*\n`;
      mensagem += `${window.location.origin}/cotacao/${cotacao.token_publico}\n\n`;
    }
    
    mensagem += `Qual opção te interessou mais? Estou à disposição! 😊`;
    
    return mensagem;
  };

  const copiarParaWhatsApp = async (cotacao: CotacaoWithRelations) => {
    const planosComparacao = cotacao.dados_extras?.planos_comparacao as Array<{
      nome: string;
      valorMensal: number;
      coberturas?: string[];
      naoInclui?: string[];
    }> | undefined;
    
    let planos: Array<{ nome: string; valorMensal: number; coberturas: string[]; naoInclui?: string[] }> = [];
    
    if (planosComparacao && planosComparacao.length > 0) {
      planos = planosComparacao.map(p => ({
        nome: p.nome,
        valorMensal: p.valorMensal,
        coberturas: p.coberturas || [],
        naoInclui: p.naoInclui || [],
      }));
    } else if (cotacao.planos) {
      planos = [{
        nome: cotacao.planos.nome,
        valorMensal: cotacao.valor_total_mensal || 0,
        coberturas: (cotacao.planos.coberturas as string[]) || [],
      }];
    }
    
    if (planos.length === 0) {
      const mensagemSimples = 
        `Olá! 🚗\n\n` +
        `Segue sua cotação de proteção veicular:\n\n` +
        `📋 *Cotação Nº:* ${cotacao.numero}\n` +
        `🚙 *Veículo:* ${cotacao.veiculo_marca} ${cotacao.veiculo_modelo} ${cotacao.veiculo_ano}\n` +
        `💰 *Valor FIPE:* R$ ${cotacao.valor_fipe?.toLocaleString('pt-BR')}\n\n` +
        `💵 *VALOR MENSAL: R$ ${cotacao.valor_total_mensal?.toFixed(2)}*\n\n` +
        `📝 Taxa de Adesão: R$ ${cotacao.valor_adesao?.toFixed(2)}\n\n` +
        `⏰ Cotação válida por ${cotacao.validade_dias || 7} dias.\n\n` +
        `Posso te ajudar com mais alguma informação?`;
      
      await navigator.clipboard.writeText(mensagemSimples);
      toast.success('Mensagem copiada! Cole no WhatsApp.');
      return;
    }
    
    const planosEnriquecidos = planos.map(p => ({
      ...p,
      beneficiosPorCategoria: categorizarBeneficios(p.coberturas || []),
    }));
    
    const dadosCotacao = {
      cliente: { nome: cotacao.leads?.nome || cotacao.nome_solicitante || 'Cliente' },
      veiculo: {
        marca: cotacao.veiculo_marca || '',
        modelo: cotacao.veiculo_modelo || '',
        ano: cotacao.veiculo_ano || 0,
        placa: cotacao.veiculo_placa,
      },
      valorFipe: cotacao.valor_fipe || 0,
      valorAdesao: cotacao.valor_adesao || 0,
      validadeDias: cotacao.validade_dias || 7,
      planos: planosEnriquecidos,
      linkCotacao: cotacao.token_publico 
        ? `${window.location.origin}/cotacao/${cotacao.token_publico}` 
        : undefined,
    };
    
    setCopiandoWhatsApp(cotacao.id);
    try {
      const { data, error } = await supabase.functions.invoke('gerar-mensagem-whatsapp', {
        body: dadosCotacao,
      });
      
      if (error) throw error;
      
      if (data?.mensagem) {
        await navigator.clipboard.writeText(data.mensagem);
        toast.success('Mensagem personalizada copiada! Cole no WhatsApp.');
      } else {
        throw new Error('Resposta sem mensagem');
      }
    } catch (error) {
      console.warn('Erro ao gerar mensagem com IA, usando fallback:', error);
      const mensagemFallback = gerarMensagemFallback(cotacao, planos);
      await navigator.clipboard.writeText(mensagemFallback);
      toast.success('Mensagem copiada! Cole no WhatsApp.');
    } finally {
      setCopiandoWhatsApp(null);
    }
  };

  const clearFilters = () => {
    setSearch('');
    setStatusFilter('all');
    setMesFilter('all');
    setDataFilter(undefined);
    setConsultorFilter('all');
  };

  const hasActiveFilters = search || statusFilter !== 'all' || mesFilter !== 'all' || dataFilter || consultorFilter !== 'all';

  // Stats - 9 status do fluxo de cotação
  const statusStats = useMemo(() => {
    if (!cotacoes) return [];
    const items = [
      { label: 'Rascunho', icon: FileText, color: 'text-gray-500', bg: 'bg-gray-500/15', count: cotacoes.filter(c => c.status === 'rascunho').length },
      { label: 'Link Enviado', icon: Link, color: 'text-blue-500', bg: 'bg-blue-500/15', count: cotacoes.filter(c => c.status === 'enviada').length },
      { label: 'Escolhendo Plano', icon: ListChecks, color: 'text-indigo-500', bg: 'bg-indigo-500/15', count: cotacoes.filter(c => ['escolhendo_plano', 'plano_escolhido'].includes(c.status_contratacao || '')).length },
      { label: 'Enviando Docs', icon: FileUp, color: 'text-cyan-500', bg: 'bg-cyan-500/15', count: cotacoes.filter(c => ['enviando_documentos', 'dados_preenchidos'].includes(c.status_contratacao || '')).length },
      { label: 'Assinando Contrato', icon: PenTool, color: 'text-purple-500', bg: 'bg-purple-500/15', count: cotacoes.filter(c => c.status_contratacao === 'assinando_contrato').length },
      { label: 'Pagando Taxa', icon: CreditCard, color: 'text-amber-500', bg: 'bg-amber-500/15', count: cotacoes.filter(c => c.status_contratacao === 'pagando_taxa').length },
      { label: 'Agendando Vistoria', icon: MapPin, color: 'text-orange-500', bg: 'bg-orange-500/15', count: cotacoes.filter(c => c.status_contratacao === 'agendando_vistoria').length },
      { label: 'Em Análise', icon: Clock, color: 'text-yellow-500', bg: 'bg-yellow-500/15', count: cotacoes.filter(c => c.status_contratacao === 'em_analise').length },
      { label: 'Fechado', icon: Trophy, color: 'text-green-500', bg: 'bg-green-500/15', count: cotacoes.filter(c => c.status === 'aceita' || c.status_contratacao === 'concluido').length },
    ];
    return items;
  }, [cotacoes]);

  // Função para obter permissões de cada cotação
  const getPermissions = (cotacao: CotacaoWithRelations): CotacoesTablePermissions => {
    const isOwner = cotacao.vendedor_id === permissions.userId;
    return {
      canEdit: permissions.cotacao.canEdit && (!permissions.cotacao.canEditOwnOnly || isOwner),
      canDelete: permissions.cotacao.canDelete,
      canSend: permissions.cotacao.canSend && (!permissions.cotacao.canEditOwnOnly || isOwner),
      canDuplicate: permissions.cotacao.canDuplicate,
      canGenerateContract: permissions.cotacao.canGenerateContract && (!permissions.cotacao.canEditOwnOnly || isOwner),
    };
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Cotações</h1>
          <p className="text-sm text-muted-foreground">
            {permissions.cotacao.viewScope === 'all' 
              ? `Gerencie todas as cotações`
              : 'Gerencie suas cotações'}
            {cotacoes && cotacoes.length > 0 && (
              <span className="text-foreground font-medium"> · {cotacoes.length} no total</span>
            )}
          </p>
        </div>
        <PermissionGate permission="cotacao.canCreate">
          <Button 
            className="gap-2 shadow-md hover:shadow-lg transition-all" 
            onClick={() => setShowCotacaoForm(true)}
          >
            <Plus className="h-4 w-4" />
            Nova Cotação
          </Button>
        </PermissionGate>
      </div>

      {/* Stats Bar - Pills flutuantes */}
      <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
        {statusStats.map((item) => {
          const isInactive = item.count === 0;
          return (
            <div 
              key={item.label} 
              className={cn(
                "flex items-center gap-2 px-3 py-2 rounded-xl border min-w-fit cursor-default select-none",
                "transition-all duration-200 hover:scale-[1.03] hover:shadow-sm",
                isInactive 
                  ? "opacity-50 bg-muted/20 border-transparent" 
                  : "bg-card border-border/60 shadow-sm"
              )}
            >
              <div className={cn("h-7 w-7 rounded-lg flex items-center justify-center shrink-0", item.bg)}>
                <item.icon className={cn("h-3.5 w-3.5", item.color)} />
              </div>
              <div className="flex items-baseline gap-1.5">
                <span className={cn("text-base font-bold leading-none", item.color)}>{item.count}</span>
                <span className="text-[10px] text-muted-foreground whitespace-nowrap leading-none">{item.label}</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Filters - Barra unificada */}
      <div className={cn(
        "flex flex-wrap items-center gap-2 px-4 py-3 rounded-xl",
        "bg-muted/30 border border-border/40"
      )}>
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/70" />
          <Input
            placeholder="Buscar lead, veículo ou número..."
            className="pl-9 h-9 border-0 bg-background/80 shadow-sm focus-visible:ring-1"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[140px] h-9 border-0 bg-background/80 shadow-sm">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos status</SelectItem>
            <SelectItem value="rascunho">Rascunho</SelectItem>
            <SelectItem value="enviada">Enviada</SelectItem>
            <SelectItem value="visualizada">Visualizada</SelectItem>
            <SelectItem value="aceita">Aceita</SelectItem>
            <SelectItem value="recusada">Recusada</SelectItem>
            <SelectItem value="expirada">Expirada</SelectItem>
          </SelectContent>
        </Select>
        <Select value={mesFilter} onValueChange={setMesFilter}>
          <SelectTrigger className="w-[150px] h-9 border-0 bg-background/80 shadow-sm">
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
        
        <Popover>
          <PopoverTrigger asChild>
            <Button 
              variant="outline" 
              size="sm"
              className={cn(
                "h-9 px-3 border-0 bg-background/80 shadow-sm",
                !dataFilter && "text-muted-foreground"
              )}
            >
              <CalendarDays className="h-4 w-4 mr-1.5" />
              {dataFilter ? format(dataFilter, 'dd/MM') : 'Data'}
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
                  Limpar
                </Button>
              </div>
            )}
          </PopoverContent>
        </Popover>

        {permissions.cotacao.viewScope !== 'own' && (
          <Select value={consultorFilter} onValueChange={setConsultorFilter}>
            <SelectTrigger className="w-[160px] h-9 border-0 bg-background/80 shadow-sm">
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
        )}
        
        {hasActiveFilters && (
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={clearFilters} 
            className="h-9 text-muted-foreground hover:text-foreground animate-in fade-in-0 slide-in-from-left-2 duration-200"
          >
            <RefreshCw className="h-3.5 w-3.5 mr-1" />
            Limpar
            <Badge variant="secondary" className="ml-1.5 h-5 px-1.5 text-[10px]">
              {[search, statusFilter !== 'all', mesFilter !== 'all', dataFilter, consultorFilter !== 'all'].filter(Boolean).length}
            </Badge>
          </Button>
        )}
      </div>

      {/* Tabela de Cotações */}
      <CotacoesTable 
        cotacoes={sortedCotacoes}
        onRowClick={handleRowClick}
        onCopiarWhatsApp={copiarParaWhatsApp}
        onPdf={handleBaixarPdf}
        onDuplicar={handleDuplicar}
        onExcluir={handleExcluir}
        copiandoWhatsAppId={copiandoWhatsApp}
        getPermissions={getPermissions}
      />

      {/* Modal de Detalhes */}
      <CotacaoDetalhesModal 
        open={showDetalhesModal}
        onOpenChange={setShowDetalhesModal}
        cotacao={cotacaoSelecionada}
        onCopiarWhatsApp={copiarParaWhatsApp}
        onPdf={handleBaixarPdf}
        onEmail={handleOpenEmailModal}
        onGerarContrato={handleOpenContratoWizard}
        onAceitar={(id) => updateCotacao.mutate({ id, status: 'aceita' })}
        isCopiandoWhatsApp={copiandoWhatsApp === cotacaoSelecionada?.id}
        isGerandoContrato={gerarContrato.isPending}
        canGenerateContract={cotacaoSelecionada ? getPermissions(cotacaoSelecionada).canGenerateContract : false}
        canSend={cotacaoSelecionada ? getPermissions(cotacaoSelecionada).canSend : false}
      />

      {/* Dialogs */}
      <CotacaoFormDialog 
        open={showCotacaoForm} 
        onOpenChange={(open) => {
          setShowCotacaoForm(open);
          if (!open) {
            setLeadIdFromUrl(null);
            setCotacaoParaDuplicar(null);
          }
        }} 
        leadId={leadIdFromUrl || undefined}
        cotacaoBase={cotacaoParaDuplicar ? {
          valor_fipe: cotacaoParaDuplicar.valor_fipe,
          valor_adicional: cotacaoParaDuplicar.valor_adicional,
          valor_adesao: cotacaoParaDuplicar.valor_adesao,
          validade_dias: cotacaoParaDuplicar.validade_dias,
          veiculo_marca: cotacaoParaDuplicar.veiculo_marca,
          veiculo_modelo: cotacaoParaDuplicar.veiculo_modelo,
          veiculo_ano: cotacaoParaDuplicar.veiculo_ano,
          veiculo_placa: cotacaoParaDuplicar.veiculo_placa,
          codigo_fipe: cotacaoParaDuplicar.codigo_fipe,
          categoria: cotacaoParaDuplicar.categoria,
          regiao: cotacaoParaDuplicar.regiao,
          nome_solicitante: cotacaoParaDuplicar.nome_solicitante || cotacaoParaDuplicar.leads?.nome || null,
          telefone1_solicitante: cotacaoParaDuplicar.telefone1_solicitante || cotacaoParaDuplicar.leads?.telefone || null,
          email_solicitante: cotacaoParaDuplicar.email_solicitante || cotacaoParaDuplicar.leads?.email || null,
          lead_id: cotacaoParaDuplicar.lead_id,
          plano_id: cotacaoParaDuplicar.plano_id,
          dados_extras: cotacaoParaDuplicar.dados_extras as any,
        } : null}
      />
      <ContratoWizard 
        open={showContratoWizard} 
        onOpenChange={setShowContratoWizard} 
        cotacaoId={selectedCotacaoId}
        onContratoCreated={handleContratoCreated}
      />
      {selectedCotacaoEmail && (
        <EnviarEmailModal
          open={showEmailModal}
          onOpenChange={setShowEmailModal}
          cotacao={selectedCotacaoEmail}
          onSuccess={() => handleMarkAsEnviada(selectedCotacaoEmail.id, selectedCotacaoEmail.lead_id)}
        />
      )}
      
      <VincularLeadModal
        open={showVincularModal}
        onOpenChange={setShowVincularModal}
        cotacaoId={cotacaoParaVincular?.id || ''}
        leadAtualId={cotacaoParaVincular?.lead_id}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ['cotacoes'] });
        }}
      />
      
      <AlertDialog open={!!cotacaoParaExcluir} onOpenChange={(open) => !open && setCotacaoParaExcluir(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Cotação</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir esta cotação? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction 
              onClick={confirmarExclusao}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
