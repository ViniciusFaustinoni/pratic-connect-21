import { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  ArrowLeft, User, Car, Loader2, Eye, Edit, Plus,
  FileCheck, FileText, Clock, AlertTriangle,
  Receipt, CheckCircle, XCircle, Send, MapPin, MessageCircle, Mail,
  Wifi, WifiOff, Calendar, Camera, Radio, DollarSign, CreditCard, Shield,
  Pencil, Check, X,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { usePermissions } from '@/hooks/usePermissions';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  STATUS_ASSOCIADO_LABELS, STATUS_VEICULO_LABELS,
  STATUS_DOCUMENTO_LABELS, TIPO_DOCUMENTO_LABELS,
  STATUS_ASSOCIADO_COLORS, STATUS_VEICULO_COLORS,
  type StatusAssociado, type StatusVeiculo,
} from '@/types/cadastro';
import { useAssociado, useVeiculosDoAssociado, useAssociadoStats, useAssociadoActions } from '@/hooks/useAssociados';
import { useDocumentosPorAssociado } from '@/hooks/useDocumentos';
import { useContratoDoAssociado, useDocumentosCotacao, useResumoFinanceiroAssociado, useCobrancasAssociado } from '@/hooks/useDocumentosCotacao';
import { useFotosAutovistoriaCotacao, agruparFotosPorCategoria, formatarTipoFoto } from '@/hooks/useFotosAutovistoria';
import { useAssociadoHistoricoCompleto } from '@/hooks/useAssociadoHistoricoCompleto';
import { VeiculoDetalhesModal } from '@/components/cadastro/VeiculoDetalhesModal';
import { VeiculoEditDialog } from '@/components/veiculos/VeiculoEditDialog';
import { useAtivarRastreadorPlataforma } from '@/hooks/useVistoriaCompletaAnalise';
import { useStatusClienteRedeVeiculos, useSincronizarStatusRedeVeiculos } from '@/hooks/useRedeVeiculosStatus';
import { getStatusComunicacaoBadgeClass, getStatusComunicacaoLabel } from '@/hooks/useVeiculosComRastreador';
import { HistoricoConversaWhatsApp } from '@/components/whatsapp/HistoricoConversaWhatsApp';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useVeiculosComRastreador } from '@/hooks/useVeiculosComRastreador';
import { MapaRastreador } from '@/components/rastreadores/MapaRastreador';
import { SuspenderAssociadoDialog } from '@/components/associados/SuspenderAssociadoDialog';
import { AssociadoSuspensoAlert } from '@/components/associados/AssociadoSuspensoAlert';
import { RastreadorVinculadoModal } from '@/components/cadastro/RastreadorVinculadoModal';
import { CancelarAssociadoDialog } from '@/components/cadastro/CancelarAssociadoDialog';
import { ExcluirAssociadoDialog, type TipoExclusao } from '@/components/cadastro/ExcluirAssociadoDialog';
import { useCriarSolicitacaoRetiradaCadastro } from '@/hooks/useRetiradaRastreador';
import { supabase } from '@/integrations/supabase/client';
import { SubstituicaoStatusCard } from '@/components/substituicao/SubstituicaoStatusCard';
import { ReativacaoWizard } from '@/components/associados/reativacao/ReativacaoWizard';
import { TrocaTitularidadeDialog } from '@/components/associados/TrocaTitularidadeDialog';

// New redesign components
import { AssociadoHeroHeader } from '@/components/associados/detalhe/AssociadoHeroHeader';
import { AssociadoResumoTab } from '@/components/associados/detalhe/AssociadoResumoTab';
import { AssociadoTabNav } from '@/components/associados/detalhe/AssociadoTabNav';
import { AdicionarRessalva } from '@/components/cadastro/AdicionarRessalva';
import { useAssociadoSituacao } from '@/hooks/useAssociadoSituacao';

// ============================================
// UTILITÁRIOS
// ============================================
const formatCPF = (cpf: string | null) => {
  if (!cpf) return '—';
  const d = cpf.replace(/\D/g, '');
  return d.length === 11 ? `${d.slice(0,3)}.${d.slice(3,6)}.${d.slice(6,9)}-${d.slice(9)}` : cpf;
};

const formatPhone = (phone: string | null) => {
  if (!phone) return '—';
  const d = phone.replace(/\D/g, '');
  if (d.length === 11) return `(${d.slice(0,2)}) ${d.slice(2,7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0,2)}) ${d.slice(2,6)}-${d.slice(6)}`;
  return phone;
};

const formatCurrency = (v: number | null | undefined) =>
  v ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v) : 'R$ 0,00';

const formatDate = (d: string | null | undefined) =>
  d ? new Date(d).toLocaleDateString('pt-BR') : '—';

const formatDateTime = (d: string) =>
  new Date(d).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });

const calcularIdade = (dn: string | null | undefined) => {
  if (!dn) return null;
  const hoje = new Date(), nasc = new Date(dn);
  let idade = hoje.getFullYear() - nasc.getFullYear();
  const m = hoje.getMonth() - nasc.getMonth();
  if (m < 0 || (m === 0 && hoje.getDate() < nasc.getDate())) idade--;
  return idade;
};

const getStatusCobrancaLabel = (status: string) => {
  const mapa: Record<string, string> = {
    'RECEIVED': 'Pago', 'CONFIRMED': 'Pago', 'RECEIVED_IN_CASH': 'Pago',
    'PENDING': 'Pendente', 'OVERDUE': 'Vencido', 'REFUNDED': 'Reembolsado', 'DELETED': 'Cancelado',
  };
  return mapa[status] || status;
};

const getStatusCobrancaClass = (status: string) => {
  if (['RECEIVED', 'CONFIRMED', 'RECEIVED_IN_CASH'].includes(status)) return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400';
  if (status === 'OVERDUE') return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400';
  if (['REFUNDED', 'DELETED'].includes(status)) return 'bg-muted text-muted-foreground';
  return 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400';
};

// Historico helpers
const getIconeEvento = (tipo: string) => {
  const mapa: Record<string, typeof CheckCircle> = {
    'associado_criado': Shield, 'status_alterado': Clock, 'dados_atualizados': Edit,
    'documento_enviado': FileText, 'documento_aprovado': CheckCircle, 'documento_reprovado': XCircle,
    'veiculo_adicionado': Car, 'veiculo_removido': XCircle,
    'instalacao_agendada': Calendar, 'instalacao_concluida': CheckCircle,
    'boleto_gerado': Receipt, 'boleto_pago': CheckCircle,
    'contrato_assinado': FileCheck, 'sinistro_aberto': AlertTriangle,
  };
  return mapa[tipo] || Clock;
};

const getCorEvento = (tipo: string) => {
  if (['documento_aprovado', 'boleto_pago', 'instalacao_concluida', 'sinistro_encerrado', 'contrato_assinado', 'chamado_concluido'].includes(tipo)) return 'text-emerald-500';
  if (['documento_reprovado', 'boleto_cancelado', 'instalacao_cancelada'].includes(tipo)) return 'text-destructive';
  if (['sinistro_aberto'].includes(tipo)) return 'text-amber-500';
  return 'text-primary';
};

const getTituloEvento = (tipo: string) => {
  const mapa: Record<string, string> = {
    'associado_criado': 'Cadastro realizado', 'status_alterado': 'Status alterado',
    'dados_atualizados': 'Dados atualizados', 'documento_enviado': 'Documento enviado',
    'documento_aprovado': 'Documento aprovado', 'documento_reprovado': 'Documento reprovado',
    'veiculo_adicionado': 'Veículo cadastrado', 'instalacao_concluida': 'Instalação concluída',
    'boleto_gerado': 'Boleto gerado', 'boleto_pago': 'Pagamento confirmado',
    'contrato_assinado': 'Contrato assinado', 'observacao_adicionada': 'Observação',
    'chamado_aberto': 'Chamado aberto', 'chamado_concluido': 'Chamado finalizado',
    'sinistro_aberto': 'Sinistro aberto', 'sinistro_encerrado': 'Sinistro encerrado',
  };
  return mapa[tipo] || tipo.replace(/_/g, ' ');
};

// ============================================
// COMPONENTE PRINCIPAL
// ============================================
export default function AssociadoDetalhe() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { isAnalistaCadastroOnly, isDiretor, isGerencia, isDesenvolvedor, isAdminMaster } = usePermissions();

  const [activeTab, setActiveTab] = useState('resumo');
  const [reativacaoWizardOpen, setReativacaoWizardOpen] = useState(false);
  const [trocaTitularidadeOpen, setTrocaTitularidadeOpen] = useState(false);
  const [suspenderDialogOpen, setSuspenderDialogOpen] = useState(false);
  const [cancelarDialogOpen, setCancelarDialogOpen] = useState(false);
  const [excluirDialogOpen, setExcluirDialogOpen] = useState(false);
  const [tipoExclusao, setTipoExclusao] = useState<TipoExclusao | null>(null);
  const [fotoModal, setFotoModal] = useState<{ open: boolean; url: string; tipo: string }>({ open: false, url: '', tipo: '' });
  const [veiculoDetalhesId, setVeiculoDetalhesId] = useState<string | null>(null);
  const [veiculoEditar, setVeiculoEditar] = useState<any>(null);
  const [mapaModalOpen, setMapaModalOpen] = useState(false);
  const [veiculoSelecionadoId, setVeiculoSelecionadoId] = useState<string | null>(null);
  const [selecionarVeiculoOpen, setSelecionarVeiculoOpen] = useState(false);
  const [rastreadorModalOpen, setRastreadorModalOpen] = useState(false);
  const [rastreadorModalData, setRastreadorModalData] = useState<any>(null);
  const [isProcessingCancelamento, setIsProcessingCancelamento] = useState(false);
  const [editingContatos, setEditingContatos] = useState(false);
  const [editTelefone, setEditTelefone] = useState('');
  const [editTelefoneSecundario, setEditTelefoneSecundario] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [isSavingContatos, setIsSavingContatos] = useState(false);

  const canEditContatos = isDiretor || isAnalistaCadastroOnly || isDesenvolvedor || isAdminMaster;

  const handleStartEditContatos = () => {
    if (!associado) return;
    setEditTelefone(associado.telefone || '');
    setEditTelefoneSecundario(associado.telefone_secundario || '');
    setEditEmail(associado.email || '');
    setEditingContatos(true);
  };

  const handleSaveContatos = async () => {
    if (!id) return;
    setIsSavingContatos(true);
    try {
      const { error } = await supabase
        .from('associados')
        .update({
          telefone: editTelefone,
          telefone_secundario: editTelefoneSecundario || null,
          email: editEmail,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id);
      if (error) throw error;
      toast.success('Contatos atualizados com sucesso');
      setEditingContatos(false);
      refetch();
    } catch (error) {
      console.error('Erro ao salvar contatos:', error);
      toast.error('Erro ao salvar contatos');
    } finally {
      setIsSavingContatos(false);
    }
  };

  const criarSolicitacaoRetirada = useCriarSolicitacaoRetiradaCadastro();

  // Data fetching
  const { data: associado, isLoading, refetch } = useAssociado(id);
  const { data: veiculos, isLoading: isLoadingVeiculos } = useVeiculosDoAssociado(id);
  const { data: documentos, isLoading: isLoadingDocs } = useDocumentosPorAssociado(id);
  const { data: stats } = useAssociadoStats(id);
  const { data: contrato } = useContratoDoAssociado(id);
  const cotacaoId = contrato?.cotacao_id;
  const { data: resumoFinanceiro } = useResumoFinanceiroAssociado(id);
  const { data: cobrancasData, isLoading: isLoadingCobrancas } = useCobrancasAssociado(id);
  const { data: historico, isLoading: isLoadingHistorico } = useAssociadoHistoricoCompleto(id);
  const { data: documentosCotacao, isLoading: isLoadingDocsCotacao } = useDocumentosCotacao(cotacaoId);
  const { data: fotosAutovistoria, isLoading: isLoadingFotos } = useFotosAutovistoriaCotacao(cotacaoId);
  const fotosAgrupadas = fotosAutovistoria ? agruparFotosPorCategoria(fotosAutovistoria) : null;
  const { data: veiculosComRastreador } = useVeiculosComRastreador(id);

  const { suspenderAssociado, reativarAssociado, isSuspendendo, isReativando } = useAssociadoActions();
  const ativarRastreadorMutation = useAtivarRastreadorPlataforma();
  const { data: statusPlataforma } = useStatusClienteRedeVeiculos(id);
  const sincronizarStatusMutation = useSincronizarStatusRedeVeiculos();
  const situacao = useAssociadoSituacao(id, contrato?.id);

  // Handlers
  const handleWhatsApp = () => {
    if (!associado?.telefone) return;
    window.open(`https://wa.me/55${associado.telefone.replace(/\D/g, '')}`, '_blank');
  };
  const handleEmail = () => {
    if (!associado?.email) return;
    window.open(`mailto:${associado.email}`, '_blank');
  };
  const handleAbrirMapa = () => {
    if (!veiculosComRastreador || veiculosComRastreador.length === 0) {
      toast.error('Nenhum veículo com rastreador instalado');
      return;
    }
    if (veiculosComRastreador.length === 1) {
      setVeiculoSelecionadoId(veiculosComRastreador[0].rastreador_id);
      setMapaModalOpen(true);
    } else {
      setSelecionarVeiculoOpen(true);
    }
  };
  const handleSuspender = (motivo: string) => { if (id) suspenderAssociado({ id, motivo }); };
  const handleReativar = () => { setReativacaoWizardOpen(true); };

  const handleConfirmRastreadorModal = async (acao: 'criar_retirada' | 'apenas_registrar') => {
    if (!rastreadorModalData || !id || !associado) return;
    setIsProcessingCancelamento(true);
    try {
      let servicoId: string | null = null;
      if (acao === 'criar_retirada') {
        const result = await criarSolicitacaoRetirada.mutateAsync({
          rastreadorId: rastreadorModalData.rastreador.id,
          veiculoId: rastreadorModalData.veiculo.id,
          associadoId: id,
          motivo: 'cancelamento_voluntario',
        });
        servicoId = result.id;
      }
      const { error: updateError } = await supabase
        .from('associados')
        .update({
          status: 'cancelado', pendencia_rastreador: true,
          pendencia_rastreador_servico_id: servicoId,
          motivo_cancelamento: 'Cancelado pelo administrador',
          data_cancelamento: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', id);
      if (updateError) throw updateError;
      toast.success('Cancelamento registrado');
      setRastreadorModalOpen(false);
      setRastreadorModalData(null);
      navigate('/cadastro/associados');
    } catch (error) {
      console.error('[handleConfirmRastreadorModal] Erro:', error);
      toast.error('Erro ao processar cancelamento');
    } finally {
      setIsProcessingCancelamento(false);
    }
  };

  // ============================================
  // LOADING / ERROR
  // ============================================
  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-36 w-full rounded-xl" />
        <Skeleton className="h-10 w-full" />
        <div className="grid grid-cols-4 gap-3">
          {[1,2,3,4].map(i => <Skeleton key={i} className="h-20 rounded-lg" />)}
        </div>
      </div>
    );
  }

  if (!associado) {
    return (
      <div className="flex flex-col items-center justify-center h-64">
        <User className="h-12 w-12 text-muted-foreground/50" />
        <h3 className="mt-4 font-semibold">Associado não encontrado</h3>
        <Button variant="link" onClick={() => navigate('/cadastro/associados')}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Voltar
        </Button>
      </div>
    );
  }

  // Computed values
  const status = associado.status as StatusAssociado;
  const idade = calcularIdade(associado.data_nascimento);
  const temCoberturaTotal = veiculos?.some(v => v.cobertura_total) ?? false;
  const temCoberturaRouboFurto = veiculos?.some(v => v.cobertura_roubo_furto) ?? false;

  const getStatusLabel = () => {
    if (status !== 'ativo') return STATUS_ASSOCIADO_LABELS[status];
    if (temCoberturaTotal) return 'Ativo';
    if (temCoberturaRouboFurto) return 'Ativo Roubo e Furto';
    return 'Ativo';
  };

  const getStatusColor = () => {
    if (status === 'ativo' && temCoberturaRouboFurto && !temCoberturaTotal) {
      return 'bg-amber-100 text-amber-800 border-amber-200';
    }
    return STATUS_ASSOCIADO_COLORS[status];
  };

  const todosDocumentos = [
    ...(documentos || []).map(d => ({ ...d, fonte: 'documentos' as const })),
    ...(documentosCotacao || []).map(d => {
      const tiposDocPessoal = ['cnh', 'cnh_frente', 'cnh_verso', 'comprovante_residencia', 'selfie', 'rg', 'rg_frente', 'rg_verso'];
      const isPessoal = tiposDocPessoal.includes(d.tipo);
      const isCrlv = d.tipo === 'crlv' || d.tipo === 'crlv_digital';
      const veiculoLabel = isPessoal ? 'Pessoal' : isCrlv && veiculos?.[0]?.placa ? veiculos[0].placa : null;
      return { ...d, fonte: 'cotacao' as const, veiculo: veiculoLabel ? { placa: veiculoLabel } : null };
    }),
  ].map(d => ({
    ...d,
    status: (status === 'ativo' && d.status === 'pendente') ? 'aprovado' : d.status
  }));

  const docsPendentes = todosDocumentos.filter(d => d.status === 'pendente').length;
  const docsAprovados = todosDocumentos.filter(d => d.status === 'aprovado').length;
  const docsReprovados = todosDocumentos.filter(d => d.status === 'reprovado').length;
  const totalFotos = fotosAutovistoria?.length || 0;

  // ============================================
  // RENDER
  // ============================================
  return (
    <div className="space-y-4">
      {/* Breadcrumb removido — já existe no header global */}

      <Button variant="ghost" size="sm" className="h-8 text-xs -ml-2" onClick={() => navigate('/cadastro/associados')}>
        <ArrowLeft className="mr-1.5 h-3.5 w-3.5" /> Voltar
      </Button>

      {/* Alerts */}
      {status === 'suspenso' && (
        <AssociadoSuspensoAlert motivo={associado.motivo_bloqueio} dataBloqueio={associado.data_bloqueio} />
      )}
      {(associado as any).pendencia_rastreador && (
        <Alert variant="destructive" className="border-destructive/50">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            <strong>Pendência de rastreador:</strong> Cancelamento pendente até devolução do equipamento ou pagamento da multa.
          </AlertDescription>
        </Alert>
      )}
      {id && status === 'ativo' && <SubstituicaoStatusCard associadoId={id} />}

      {/* Hero Header */}
      <AssociadoHeroHeader
        associado={associado}
        status={status}
        statusLabel={getStatusLabel()}
        statusColor={getStatusColor()}
        contrato={contrato}
        resumoFinanceiro={resumoFinanceiro}
        veiculosComRastreador={veiculosComRastreador}
        statusPlataforma={statusPlataforma}
        permissions={{ isAnalistaCadastroOnly, isDiretor, isGerencia, isDesenvolvedor, isAdminMaster }}
        docsPendentes={docsPendentes}
        coberturasSuspensas={situacao.coberturasSuspensas}
        onSuspender={() => setSuspenderDialogOpen(true)}
        onReativar={handleReativar}
        onCancelar={() => setCancelarDialogOpen(true)}
        onAbrirMapa={handleAbrirMapa}
        onWhatsApp={handleWhatsApp}
        onEmail={handleEmail}
        onSincronizar={() => sincronizarStatusMutation.mutate({ associadoId: id!, forcarAtualizacao: true })}
        onExcluir={(tipo) => { setTipoExclusao(tipo as TipoExclusao); setExcluirDialogOpen(true); }}
        setActiveTab={setActiveTab}
        isReativando={isReativando}
        isSincronizando={sincronizarStatusMutation.isPending}
      />

      {/* Tab Nav */}
      <AssociadoTabNav
        activeTab={activeTab}
        onTabChange={setActiveTab}
        veiculosCount={veiculos?.length || 0}
        docsPendentes={docsPendentes}
        isAnalistaCadastroOnly={isAnalistaCadastroOnly}
      />

      {/* Tab Content */}
      <div className="bg-card rounded-b-lg border border-t-0 p-4 sm:p-5">
        {/* RESUMO */}
        {activeTab === 'resumo' && (
          <AssociadoResumoTab
            stats={stats}
            resumoFinanceiro={resumoFinanceiro}
            contrato={contrato}
            associado={associado}
            historico={historico}
            isLoadingHistorico={isLoadingHistorico}
            situacao={situacao}
          />
        )}

        {/* DADOS PESSOAIS */}
        {activeTab === 'dados' && (
          <div className="grid gap-4 md:grid-cols-2">
            <Card className="border-border/60">
              <CardHeader className="pb-3"><CardTitle className="text-sm font-semibold">Dados Pessoais</CardTitle></CardHeader>
              <CardContent className="space-y-3 text-sm">
                <DataField label="Nome Completo" value={associado.nome} />
                <div className="grid grid-cols-2 gap-3">
                  <DataField label="CPF" value={formatCPF(associado.cpf)} />
                  <DataField label="RG" value={associado.rg || '—'} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <DataField label="Nascimento" value={`${formatDate(associado.data_nascimento)}${idade ? ` (${idade} anos)` : ''}`} />
                  <DataField label="Sexo" value={associado.sexo === 'M' ? 'Masculino' : associado.sexo === 'F' ? 'Feminino' : '—'} />
                </div>
              </CardContent>
            </Card>

            <Card className="border-border/60">
              <CardHeader className="pb-3"><CardTitle className="text-sm font-semibold">Endereço</CardTitle></CardHeader>
              <CardContent className="space-y-3 text-sm">
                <DataField label="CEP" value={associado.cep || '—'} />
                <DataField label="Logradouro" value={`${associado.logradouro || '—'}${associado.numero ? `, ${associado.numero}` : ''}${associado.complemento ? ` - ${associado.complemento}` : ''}`} />
                <DataField label="Bairro" value={associado.bairro || '—'} />
                <DataField label="Cidade / UF" value={`${associado.cidade || '—'} ${associado.uf ? `- ${associado.uf}` : ''}`} />
              </CardContent>
            </Card>

            <Card className="border-border/60">
              <CardHeader className="pb-3 flex flex-row items-center justify-between">
                <CardTitle className="text-sm font-semibold">Contatos</CardTitle>
                {canEditContatos && !editingContatos && (
                  <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={handleStartEditContatos}>
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                )}
                {editingContatos && (
                  <div className="flex gap-1">
                    <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-emerald-600" onClick={handleSaveContatos} disabled={isSavingContatos}>
                      {isSavingContatos ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                    </Button>
                    <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-destructive" onClick={() => setEditingContatos(false)} disabled={isSavingContatos}>
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                )}
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                {editingContatos ? (
                  <>
                    <div>
                      <p className="text-[11px] text-muted-foreground mb-1">Telefone Principal</p>
                      <Input value={editTelefone} onChange={(e) => setEditTelefone(e.target.value)} placeholder="(00) 00000-0000" className="h-8 text-sm" />
                    </div>
                    <div>
                      <p className="text-[11px] text-muted-foreground mb-1">Telefone Secundário</p>
                      <Input value={editTelefoneSecundario} onChange={(e) => setEditTelefoneSecundario(e.target.value)} placeholder="(00) 00000-0000" className="h-8 text-sm" />
                    </div>
                    <div>
                      <p className="text-[11px] text-muted-foreground mb-1">Email</p>
                      <Input value={editEmail} onChange={(e) => setEditEmail(e.target.value)} placeholder="email@exemplo.com" className="h-8 text-sm" />
                    </div>
                  </>
                ) : (
                  <>
                    <DataField label="Telefone Principal" value={formatPhone(associado.telefone)} />
                    <DataField label="Telefone Secundário" value={formatPhone(associado.telefone_secundario)} />
                    <DataField label="Email" value={associado.email || '—'} />
                  </>
                )}
                <div className="flex gap-2 pt-2">
                  <Button size="sm" variant="outline" onClick={handleWhatsApp}>
                    <MessageCircle className="mr-1.5 h-3.5 w-3.5" /> WhatsApp
                  </Button>
                  <Button size="sm" variant="outline" onClick={handleEmail}>
                    <Mail className="mr-1.5 h-3.5 w-3.5" /> Email
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card className="border-border/60">
              <CardHeader className="pb-3"><CardTitle className="text-sm font-semibold">Plano e Contrato</CardTitle></CardHeader>
              <CardContent className="space-y-3 text-sm">
                <DataField label="Plano" value={associado.planos?.nome || '—'} />
                <DataField label="Adesão" value={formatDate(associado.data_adesao)} />
                <DataField label="Contrato" value={associado.contratos?.[0]?.numero || '—'} />
                <div className="grid grid-cols-2 gap-3">
                  <DataField label="Vencimento" value={`Todo dia ${associado.dia_vencimento || 15}`} />
                  <DataField label="Mensalidade" value={contrato?.valor_mensal ? formatCurrency(contrato.valor_mensal) : '—'} />
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* VEÍCULOS */}
        {activeTab === 'veiculos' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold">Veículos ({veiculos?.length || 0})</h3>
              <Button size="sm"><Plus className="mr-1.5 h-3.5 w-3.5" /> Adicionar</Button>
            </div>
            {isLoadingVeiculos ? (
              <Skeleton className="h-48 w-full" />
            ) : veiculos && veiculos.length > 0 ? (
              <div className="grid gap-3">
                {veiculos.map((v) => (
                  <Card key={v.id} className="border-border/60 hover:border-border transition-colors">
                    <CardContent className="p-4 sm:p-5">
                      <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                        <div className="space-y-3 flex-1 min-w-0">
                          <div className="flex items-center gap-2.5 flex-wrap">
                            <h4 className="text-base font-semibold">{v.marca} {v.modelo} {v.ano_modelo}</h4>
                            <Badge className={cn('text-[10px]', STATUS_VEICULO_COLORS[(v.status as StatusVeiculo) || 'em_analise'])}>
                              {STATUS_VEICULO_LABELS[(v.status as StatusVeiculo) || 'em_analise']}
                            </Badge>
                          </div>
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                            <DataField label="Placa" value={v.placa} mono />
                            <DataField label="Chassi" value={v.chassi || '—'} mono small />
                            <DataField label="Renavam" value={v.renavam || '—'} />
                            <DataField label="Cor" value={v.cor || '—'} />
                          </div>
                          <div className="text-sm">
                            <DataField label="Valor FIPE" value={formatCurrency(v.valor_fipe)} />
                          </div>
                          <Separator className="my-2" />
                          <div className="flex items-center gap-3 text-xs">
                            {v.rastreador ? (
                              <span className="flex items-center gap-1.5 text-emerald-600">
                                <Wifi className="h-3.5 w-3.5" />
                                {v.rastreador?.codigo}
                              </span>
                            ) : (
                              <span className="flex items-center gap-1.5 text-muted-foreground">
                                <WifiOff className="h-3.5 w-3.5" /> Sem rastreador
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => setVeiculoDetalhesId(v.id)}>
                            <Eye className="h-3 w-3 mr-1" /> Detalhes
                          </Button>
                          <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => setVeiculoEditar(v)}>
                            <Edit className="h-3 w-3 mr-1" /> Editar
                          </Button>
                          {v.rastreador && v.rastreador.plataforma === 'softruck' && !v.rastreador.plataforma_device_id && (
                            <Button size="sm" className="h-8 text-xs bg-emerald-600 hover:bg-emerald-700 text-white"
                              onClick={() => ativarRastreadorMutation.mutateAsync({
                                instalacaoId: '', veiculoId: v.id, associadoId: id!,
                                rastreadorId: v.rastreador!.id, imei: v.rastreador!.imei!,
                              })}
                              disabled={ativarRastreadorMutation.isPending}>
                              {ativarRastreadorMutation.isPending
                                ? <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                                : <Radio className="h-3 w-3 mr-1" />}
                              Ativar
                            </Button>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <Card className="border-dashed border-border/60">
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <Car className="h-10 w-10 text-muted-foreground/40" />
                  <p className="mt-3 text-sm text-muted-foreground">Nenhum veículo cadastrado</p>
                  <Button size="sm" className="mt-3"><Plus className="mr-1.5 h-3.5 w-3.5" /> Adicionar</Button>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {/* DOCUMENTOS */}
        {activeTab === 'documentos' && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <MiniStat value={todosDocumentos.length} label="Total" />
              <MiniStat value={docsAprovados} label="Aprovados" color="text-emerald-600" />
              <MiniStat value={docsPendentes} label="Pendentes" color="text-amber-600" />
              <MiniStat value={totalFotos} label="Fotos Vistoria" color="text-primary" />
            </div>

            {docsReprovados > 0 && (
              <Card className="border-destructive/30 bg-destructive/5">
                <CardContent className="p-3 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <XCircle className="h-4 w-4 text-destructive shrink-0" />
                    <span className="text-sm font-medium text-destructive">{docsReprovados} reprovado(s)</span>
                  </div>
                  <Button size="sm" variant="outline" className="h-7 text-xs"><Send className="h-3 w-3 mr-1" /> Solicitar Reenvio</Button>
                </CardContent>
              </Card>
            )}

            <Card className="border-border/60">
              <CardContent className="p-0">
                {isLoadingDocs || isLoadingDocsCotacao ? (
                  <Skeleton className="h-48 w-full m-4" />
                ) : todosDocumentos.length > 0 ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-xs">Documento</TableHead>
                        <TableHead className="text-xs">Veículo</TableHead>
                        <TableHead className="text-xs">Enviado</TableHead>
                        <TableHead className="text-xs">Status</TableHead>
                        <TableHead className="text-xs">Ação</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {todosDocumentos.map((d) => (
                        <TableRow key={d.id}>
                          <TableCell className="font-medium text-xs">
                            {TIPO_DOCUMENTO_LABELS[d.tipo] || d.tipo.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                          </TableCell>
                          <TableCell className="text-xs">
                            {'veiculo' in d && d.veiculo ? <Badge variant="outline" className="text-[10px]">{d.veiculo.placa}</Badge> : '—'}
                          </TableCell>
                          <TableCell className="text-xs">{formatDate(d.created_at)}</TableCell>
                          <TableCell>
                            <Badge className={cn('text-[10px]',
                              d.status === 'aprovado' && 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
                              d.status === 'pendente' && 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
                              d.status === 'reprovado' && 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
                            )}>
                              {STATUS_DOCUMENTO_LABELS[d.status] || d.status}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {'arquivo_url' in d && d.arquivo_url ? (
                              <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => window.open(d.arquivo_url, '_blank')}>
                                <Eye className="h-3 w-3" />
                              </Button>
                            ) : d.fonte === 'documentos' ? (
                              <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => navigate(`/cadastro/documentos/${d.id}`)}>
                                <Eye className="h-3 w-3" />
                              </Button>
                            ) : null}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <div className="flex flex-col items-center justify-center py-10">
                    <FileText className="h-8 w-8 text-muted-foreground/40" />
                    <p className="mt-2 text-sm text-muted-foreground">Nenhum documento</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Galeria de Autovistoria */}
            {fotosAgrupadas && (totalFotos > 0) && (
              <Card className="border-border/60">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <Camera className="h-4 w-4" /> Galeria de Autovistoria
                    <Badge variant="secondary" className="text-[10px] ml-1">{totalFotos}</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {['exterior', 'documentos', 'interior', 'outros'].map((cat) => {
                    const fotos = fotosAgrupadas[cat as keyof typeof fotosAgrupadas];
                    if (!fotos || fotos.length === 0) return null;
                    return (
                      <div key={cat} className="mb-4 last:mb-0">
                        <p className="text-xs font-medium text-muted-foreground mb-2 capitalize">{cat} ({fotos.length})</p>
                        <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
                          {fotos.map((foto: any) => (
                            <div key={foto.id} className="relative group cursor-pointer rounded-lg overflow-hidden border bg-muted/50 aspect-square"
                              onClick={() => setFotoModal({ open: true, url: foto.arquivo_url, tipo: formatarTipoFoto(foto.tipo) })}>
                              <img src={foto.arquivo_url} alt={formatarTipoFoto(foto.tipo)}
                                className="w-full h-full object-cover transition-transform group-hover:scale-105" />
                              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                <Eye className="h-5 w-5 text-white" />
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {/* FINANCEIRO */}
        {activeTab === 'financeiro' && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <Card className="border-border/60">
                <CardContent className="p-3 text-center">
                  <p className="text-[11px] text-muted-foreground">Situação</p>
                  {resumoFinanceiro?.emAtraso && resumoFinanceiro.emAtraso > 0
                    ? <Badge className="mt-1.5 bg-destructive/10 text-destructive text-[10px]">EM ATRASO</Badge>
                    : <Badge className="mt-1.5 bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 text-[10px]">EM DIA</Badge>}
                </CardContent>
              </Card>
              <Card className="border-border/60">
                <CardContent className="p-3 text-center">
                  <p className="text-[11px] text-muted-foreground">Próxima Fatura</p>
                  <p className="text-base font-bold mt-1">{resumoFinanceiro?.proximaCobranca?.data_vencimento ? formatDate(resumoFinanceiro.proximaCobranca.data_vencimento) : '—'}</p>
                </CardContent>
              </Card>
              <Card className="border-border/60">
                <CardContent className="p-3 text-center">
                  <p className="text-[11px] text-muted-foreground">Total Pago</p>
                  <p className="text-base font-bold mt-1 text-emerald-600">{formatCurrency(cobrancasData?.totais.pago || 0)}</p>
                </CardContent>
              </Card>
              <Card className="border-border/60">
                <CardContent className="p-3 text-center">
                  <p className="text-[11px] text-muted-foreground">Em Aberto</p>
                  <p className="text-base font-bold mt-1">{formatCurrency(cobrancasData?.totais.emAberto || 0)}</p>
                </CardContent>
              </Card>
            </div>

            <Card className="border-border/60">
              <CardHeader className="pb-3"><CardTitle className="text-sm font-semibold">Últimas Faturas</CardTitle></CardHeader>
              <CardContent className="p-0">
                {isLoadingCobrancas ? (
                  <Skeleton className="h-48 w-full m-4" />
                ) : cobrancasData?.faturas && cobrancasData.faturas.length > 0 ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-xs">Referência</TableHead>
                        <TableHead className="text-xs">Vencimento</TableHead>
                        <TableHead className="text-xs">Valor</TableHead>
                        <TableHead className="text-xs">Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {cobrancasData.faturas.slice(0, 10).map((f: any) => (
                        <TableRow key={f.id}>
                          <TableCell className="font-medium text-xs">{f.referencia || f.tipo}</TableCell>
                          <TableCell className="text-xs">{formatDate(f.data_vencimento)}</TableCell>
                          <TableCell className="text-xs">{formatCurrency(f.valor)}</TableCell>
                          <TableCell>
                            <Badge className={cn('text-[10px]', getStatusCobrancaClass(f.status))}>
                              {getStatusCobrancaLabel(f.status)}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <div className="flex flex-col items-center justify-center py-10">
                    <Receipt className="h-8 w-8 text-muted-foreground/40" />
                    <p className="mt-2 text-sm text-muted-foreground">Nenhuma cobrança</p>
                  </div>
                )}
              </CardContent>
            </Card>

          </div>
        )}

        {/* HISTÓRICO */}
        {activeTab === 'historico' && (
          <div className="space-y-4">
            <h3 className="text-base font-semibold">Histórico de Atividades</h3>
            <AdicionarRessalva associadoId={id!} />
            {isLoadingHistorico ? (
              <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin" /></div>
            ) : historico && historico.length > 0 ? (
              <div className="space-y-0">
                {historico.map((evento, i) => {
                  const Icon = getIconeEvento(evento.tipo);
                  const cor = getCorEvento(evento.tipo);
                  const isLast = i === historico.length - 1;
                  return (
                    <div key={evento.id} className="flex gap-3">
                      <div className="flex flex-col items-center">
                        <div className="p-1.5 rounded-full bg-muted">
                          <Icon className={cn('h-3.5 w-3.5', cor)} />
                        </div>
                        {!isLast && <div className="w-px flex-1 bg-border min-h-[32px]" />}
                      </div>
                      <div className="pb-5 flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-sm font-medium">{getTituloEvento(evento.tipo)}</p>
                            <p className="text-xs text-muted-foreground truncate">{evento.descricao}</p>
                            {evento.usuario && (
                              <p className="text-[10px] text-muted-foreground mt-0.5">Por: {evento.usuario.nome}</p>
                            )}
                          </div>
                          <span className="text-[10px] text-muted-foreground whitespace-nowrap">{formatDateTime(evento.data)}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-10">Nenhum histórico registrado</p>
            )}
          </div>
        )}

        {/* WHATSAPP */}
        {activeTab === 'whatsapp' && (
          <HistoricoConversaWhatsApp
            telefone={associado.whatsapp || associado.telefone}
            titulo="Mensagens"
            altura="h-[500px]"
            mostrarHeader={false}
          />
        )}
      </div>

      {/* ============================================ */}
      {/* DIALOGS & MODALS (unchanged logic) */}
      {/* ============================================ */}
      <SuspenderAssociadoDialog
        open={suspenderDialogOpen}
        onClose={() => setSuspenderDialogOpen(false)}
        associadoNome={associado.nome}
        onConfirm={handleSuspender}
        isLoading={isSuspendendo}
      />

      <CancelarAssociadoDialog
        open={cancelarDialogOpen}
        onClose={() => setCancelarDialogOpen(false)}
        associado={{
          id: id || '', nome: associado.nome, status: associado.status,
          pendencia_rastreador: (associado as any).pendencia_rastreador || false,
        }}
        onSuccess={() => { setCancelarDialogOpen(false); refetch(); }}
      />

      {tipoExclusao && (
        <ExcluirAssociadoDialog
          open={excluirDialogOpen}
          onClose={() => { setExcluirDialogOpen(false); setTipoExclusao(null); }}
          associado={{
            id: id || '', nome: associado.nome, status: associado.status,
            pendencia_rastreador: (associado as any).pendencia_rastreador || false,
          }}
          tipoExclusao={tipoExclusao}
          onSuccess={() => { setExcluirDialogOpen(false); setTipoExclusao(null); refetch(); }}
        />
      )}

      <VeiculoDetalhesModal
        open={!!veiculoDetalhesId}
        onClose={() => setVeiculoDetalhesId(null)}
        veiculo={veiculos?.find(v => v.id === veiculoDetalhesId) || null}
        associadoId={id || ''}
      />

      <VeiculoEditDialog
        open={!!veiculoEditar}
        onClose={() => setVeiculoEditar(null)}
        veiculo={veiculoEditar}
      />

      {/* Modal Seleção Veículo */}
      <Dialog open={selecionarVeiculoOpen} onOpenChange={setSelecionarVeiculoOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Car className="h-5 w-5" /> Selecionar Veículo</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            {veiculosComRastreador?.map((v) => (
              <div key={v.rastreador_id} className="p-3 border rounded-lg cursor-pointer hover:bg-muted transition-colors"
                onClick={() => { setVeiculoSelecionadoId(v.rastreador_id); setSelecionarVeiculoOpen(false); setMapaModalOpen(true); }}>
                <div className="flex items-center justify-between">
                  <div><span className="font-semibold">{v.placa}</span><p className="text-sm text-muted-foreground">{v.marca} {v.modelo}</p></div>
                  <Badge className={getStatusComunicacaoBadgeClass(v.status_comunicacao)}>
                    {getStatusComunicacaoLabel(v.status_comunicacao)}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal Mapa */}
      <Dialog open={mapaModalOpen} onOpenChange={setMapaModalOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><MapPin className="h-5 w-5" /> Localização do Veículo</DialogTitle>
          </DialogHeader>
          {veiculoSelecionadoId && <MapaRastreador rastreadorId={veiculoSelecionadoId} altura="450px" mostrarControles />}
        </DialogContent>
      </Dialog>

      {/* Modal Foto */}
      <Dialog open={fotoModal.open} onOpenChange={(open) => setFotoModal({ ...fotoModal, open })}>
        <DialogContent className="max-w-3xl">
          <h3 className="text-lg font-semibold">{fotoModal.tipo}</h3>
          <img src={fotoModal.url} alt={fotoModal.tipo} className="w-full max-h-[70vh] object-contain rounded-lg" />
        </DialogContent>
      </Dialog>

      {/* Modal Rastreador Vinculado */}
      {rastreadorModalData && (
        <RastreadorVinculadoModal
          open={rastreadorModalOpen}
          onOpenChange={setRastreadorModalOpen}
          associado={{ id: id || '', nome: associado.nome }}
          rastreador={rastreadorModalData.rastreador}
          veiculo={rastreadorModalData.veiculo}
          onConfirm={handleConfirmRastreadorModal}
          isLoading={isProcessingCancelamento}
        />
      )}

      {/* Wizard Reativação */}
      {id && contrato && (
        <ReativacaoWizard
          open={reativacaoWizardOpen}
          onOpenChange={setReativacaoWizardOpen}
          associadoId={id}
          contratoId={contrato.id}
          situacao={situacao}
        />
      )}
    </div>
  );
}

// ============================================
// SUB-COMPONENTS
// ============================================
function DataField({ label, value, mono, small }: { label: string; value: string; mono?: boolean; small?: boolean }) {
  return (
    <div>
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <p className={cn('font-medium', mono && 'font-mono', small && 'text-xs')}>{value}</p>
    </div>
  );
}

function MiniStat({ value, label, color }: { value: number; label: string; color?: string }) {
  return (
    <Card className="border-border/60">
      <CardContent className="p-3 text-center">
        <p className={cn('text-xl font-bold', color)}>{value}</p>
        <p className="text-[11px] text-muted-foreground">{label}</p>
      </CardContent>
    </Card>
  );
}
