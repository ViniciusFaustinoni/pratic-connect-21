import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
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
  ArrowLeft,
  ArrowRight,
  CheckCircle,
  XCircle,
  FileText,
  User,
  Car,
  FileCheck,
  Clock,
  Phone,
  Mail,
  MapPin,
  Calendar,
  DollarSign,
  AlertTriangle,
  Wrench,
  CreditCard,
  Smartphone,
  Wifi,
  Hash,
  Puzzle,
  ShieldCheck,
  ShieldOff,
  Zap,
  Loader2,
  Building2,
  RefreshCw,
  Upload,
} from 'lucide-react';
import {
  useProposta,
  usePropostasPendentes,
  useAprovarProposta,
  useSolicitarDocumentos,
  useReprovarProposta,
} from '@/hooks/usePropostasPendentes';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useAtivarRastreador } from '@/hooks/useAtivarRastreador';
import { SolicitarDocumentosDialog } from '@/components/cadastro/SolicitarDocumentosDialog';
import { DocumentosAnexadosCard } from '@/components/cadastro/DocumentosAnexadosCard';
import { DocumentosSolicitadosCard } from '@/components/cadastro/DocumentosSolicitadosCard';
import { VistoriaFotosCard } from '@/components/cadastro/VistoriaFotosCard';
import { VistoriaObservacoesCard } from '@/components/cadastro/VistoriaObservacoesCard';
import { AssinaturaClienteCard } from '@/components/cadastro/AssinaturaClienteCard';
import { ReprovarPropostaDialog } from '@/components/cadastro/ReprovarPropostaDialog';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';

// ============================================
// FUNÇÃO: Mascarar CPF
// ============================================
function maskCPF(cpf: string | null): string {
  if (!cpf) return '---';
  const clean = cpf.replace(/\D/g, '');
  if (clean.length !== 11) return cpf;
  return `***.${clean.slice(3, 6)}.***-${clean.slice(9)}`;
}

// ============================================
// FUNÇÃO: Formatar valor
// ============================================
function formatCurrency(value: number | null): string {
  if (value === null || value === undefined) return 'R$ ---';
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
}

// ============================================
// COMPONENTE: Info Item
// ============================================
function InfoItem({
  icon: Icon,
  label,
  value,
  highlight,
  iconColor = 'text-muted-foreground',
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string | null | undefined;
  highlight?: boolean;
  iconColor?: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <div className="p-2 rounded-lg bg-muted/50 flex-shrink-0">
        <Icon className={cn("h-4 w-4", iconColor)} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-xs text-muted-foreground uppercase tracking-wide">{label}</p>
        <p className={cn(
          "text-foreground break-words", 
          highlight && "font-semibold text-base"
        )}>
          {value || '---'}
        </p>
      </div>
    </div>
  );
}

// ============================================
// COMPONENTE: Status Badge
// ============================================
function StatusBadge({ status }: { status: string | null }) {
  const config: Record<string, { label: string; color: string }> = {
    assinado: { label: 'Aguardando Análise', color: 'bg-warning/20 text-warning border-warning' },
    em_analise: { label: 'Em Análise', color: 'bg-info/20 text-info border-info' },
    ativo: { label: 'Aprovado', color: 'bg-success/20 text-success border-success' },
    reprovado: { label: 'Reprovado', color: 'bg-destructive/20 text-destructive border-destructive' },
  };

  const statusConfig = config[status || ''] || { label: status || 'Desconhecido', color: '' };

  return (
    <Badge className={cn("text-sm px-3 py-1", statusConfig.color)}>
      {statusConfig.label}
    </Badge>
  );
}

// ============================================
// COMPONENTE PRINCIPAL
// ============================================
export default function PropostaAnalise() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [showSolicitarDocs, setShowSolicitarDocs] = useState(false);
  const [showReprovar, setShowReprovar] = useState(false);
  const [showConfirmAprovar, setShowConfirmAprovar] = useState(false);
  const [showConfirmAtivacaoSoftruck, setShowConfirmAtivacaoSoftruck] = useState(false);
  
  // Campos editáveis do veículo para SGA Hinova
  const [veiculoRenavam, setVeiculoRenavam] = useState('');
  const [veiculoChassi, setVeiculoChassi] = useState('');
  const [isSavingVeiculo, setIsSavingVeiculo] = useState(false);
  

  const { data: proposta, isLoading } = useProposta(id);
  const { data: todasPropostas } = usePropostasPendentes();

  const aprovarMutation = useAprovarProposta();
  const solicitarDocsMutation = useSolicitarDocumentos();
  const reprovarMutation = useReprovarProposta();
  const ativarRastreadorMutation = useAtivarRastreador();

  // Encontrar próxima proposta
  const currentIndex = todasPropostas?.findIndex((p) => p.id === id) ?? -1;
  const nextProposta = currentIndex >= 0 && todasPropostas ? todasPropostas[currentIndex + 1] : null;

  const handleAprovar = () => {
    setShowConfirmAprovar(true);
  };

  const handleConfirmarAprovacao = async () => {
    if (!id) return;
    setShowConfirmAprovar(false);
    
    // Salvar RENAVAM/CHASSI no veículo antes de aprovar (se preenchidos)
    if (proposta?.veiculo_id && (veiculoRenavam || veiculoChassi)) {
      const updateData: Record<string, string | null> = {};
      if (veiculoRenavam) updateData.renavam = veiculoRenavam;
      if (veiculoChassi) updateData.chassi = veiculoChassi;
      
      const { error: updateError } = await supabase
        .from('veiculos')
        .update(updateData)
        .eq('id', proposta.veiculo_id);
      
      if (updateError) {
        toast.error('Erro ao salvar dados do veículo', { description: updateError.message });
        return;
      }
    }
    
    await aprovarMutation.mutateAsync(id);
    // Navegar para próxima ou voltar para lista
    if (nextProposta) {
      navigate(`/cadastro/propostas/${nextProposta.id}`);
    } else {
      navigate('/cadastro/propostas');
    }
  };

  const handleSolicitarDocumentos = async (documentos: string[], observacoes: string) => {
    if (!proposta?.associado_id || !id) return;
    await solicitarDocsMutation.mutateAsync({
      contratoId: id,
      associadoId: proposta.associado_id,
      documentos,
      observacoes,
    });
    setShowSolicitarDocs(false);
    // Navegar para próxima ou voltar para lista
    if (nextProposta) {
      navigate(`/cadastro/propostas/${nextProposta.id}`);
    } else {
      navigate('/cadastro/propostas');
    }
  };

  const handleReprovar = async (motivo: string, justificativa: string) => {
    if (!proposta?.associado_id || !id) return;
    await reprovarMutation.mutateAsync({
      contratoId: id,
      associadoId: proposta.associado_id,
      motivo,
      justificativa,
    });
    setShowReprovar(false);
    // Navegar para próxima ou voltar para lista
    if (nextProposta) {
      navigate(`/cadastro/propostas/${nextProposta.id}`);
    } else {
      navigate('/cadastro/propostas');
    }
  };

  // Handler para ativar rastreador Softruck
  const handleConfirmarAtivacaoSoftruck = async () => {
    if (!proposta?.instalacao_info?.rastreador_imei || 
        !proposta?.veiculo_id || 
        !proposta?.associado_id) {
      return;
    }
    
    setShowConfirmAtivacaoSoftruck(false);
    
    try {
      await ativarRastreadorMutation.mutateAsync({
        imei: proposta.instalacao_info.rastreador_imei,
        veiculoId: proposta.veiculo_id,
        associadoId: proposta.associado_id,
        associadoEmail: proposta.cliente_email || undefined,
      });
      
      // Refetch para atualizar estado
      queryClient.invalidateQueries({ queryKey: ['proposta', id] });
    } catch (error) {
      console.error('Erro ao ativar rastreador:', error);
    }
  };

  // Verificar se pode ativar Softruck
  const podeAtivarSoftruck = proposta?.status === 'ativo' &&
    proposta?.instalacao_info?.rastreador_plataforma === 'softruck' &&
    !proposta?.instalacao_info?.rastreador_ativado &&
    !proposta?.veiculo_cobertura_total;

  const isAtivandoSoftruck = ativarRastreadorMutation.isPending;


  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-48 bg-muted" />
        <div className="grid gap-6 lg:grid-cols-5">
          <div className="lg:col-span-3 space-y-6">
            <Skeleton className="h-64 w-full bg-muted" />
            <Skeleton className="h-64 w-full bg-muted" />
          </div>
          <div className="lg:col-span-2 space-y-6">
            <Skeleton className="h-32 w-full bg-muted" />
            <Skeleton className="h-48 w-full bg-muted" />
          </div>
        </div>
      </div>
    );
  }

  if (!proposta) {
    return (
      <div className="text-center py-12">
        <AlertTriangle className="h-12 w-12 mx-auto mb-4 text-warning" />
        <h2 className="text-xl font-semibold text-foreground">Proposta não encontrada</h2>
        <p className="text-muted-foreground mt-2">A proposta solicitada não existe ou foi removida.</p>
        <Button
          variant="outline"
          className="mt-4"
          onClick={() => navigate('/cadastro/propostas')}
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Voltar para Lista
        </Button>
      </div>
    );
  }

  const associado = proposta.associado;

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* HEADER */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between pb-4 border-b border-border">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate('/cadastro/propostas')}
            className="text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-foreground">
              Análise de Proposta
            </h1>
            <p className="text-muted-foreground">
              Contrato #{proposta.numero || id?.slice(0, 8)}
            </p>
          </div>
        </div>
        {nextProposta && (
          <Button
            variant="outline"
            onClick={() => navigate(`/cadastro/propostas/${nextProposta.id}`)}
            className="border-border"
          >
            Próxima Proposta
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        )}
      </div>

      {/* BANNER DE REANÁLISE - Documentos enviados pelo cliente */}
      {proposta.documentos_solicitados_enviados && proposta.documentos_solicitados_enviados.length > 0 && (
        <Card className="border-amber-500 bg-amber-500/10">
          <CardContent className="py-4">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-lg bg-amber-500/20">
                <RefreshCw className="h-5 w-5 text-amber-500" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-amber-600 dark:text-amber-400">
                  Reanálise Necessária
                </h3>
                <p className="text-sm text-muted-foreground mt-0.5">
                  O cliente enviou {proposta.documentos_solicitados_enviados.length} documento(s) solicitado(s). 
                  Verifique a seção "Documentos Solicitados" na coluna direita.
                </p>
              </div>
              <Badge className="bg-amber-500/20 text-amber-600 border-amber-500/30">
                {proposta.documentos_solicitados_enviados.length} novo(s)
              </Badge>
            </div>
          </CardContent>
        </Card>
      )}

      {/* CONTEÚDO */}
      <div className="grid gap-6 lg:grid-cols-5">
        {/* COLUNA ESQUERDA - 60% */}
        <div className="lg:col-span-3 space-y-6">
          {/* Dados do Cliente */}
          <Card className="border-border bg-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-foreground">
                <User className="h-5 w-5 text-purple-500" />
                Dados do Cliente
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <InfoItem
                icon={User}
                label="Nome Completo"
                value={proposta.cliente_nome || associado?.nome}
                highlight
                iconColor="text-primary"
              />
              <InfoItem
                icon={FileText}
                label="CPF"
                value={maskCPF(proposta.cliente_cpf || associado?.cpf)}
                iconColor="text-primary"
              />
              <InfoItem
                icon={Phone}
                label="Telefone"
                value={proposta.cliente_telefone || associado?.telefone}
                iconColor="text-primary"
              />
              <InfoItem
                icon={Mail}
                label="Email"
                value={proposta.cliente_email || associado?.email}
                iconColor="text-primary"
              />
              <div className="sm:col-span-2">
                <InfoItem
                  icon={MapPin}
                  label="Endereço"
                  value={
                    associado?.logradouro
                      ? `${associado.logradouro}, ${associado.numero || 'S/N'} - ${associado.bairro || ''}, ${associado.cidade || ''} - ${associado.uf || ''}`
                      : proposta.endereco_completo || null
                  }
                  iconColor="text-primary"
                />
              </div>
            </CardContent>
          </Card>

          {/* Dados do Veículo */}
          <Card className="border-border bg-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-foreground">
                <Car className="h-5 w-5 text-purple-500" />
                Dados do Veículo
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <InfoItem
                  icon={Car}
                  label="Modelo/Marca"
                  value={`${proposta.veiculo_modelo || '---'} ${proposta.veiculo_marca || ''}`}
                  highlight
                  iconColor="text-purple-500"
                />
                <InfoItem
                  icon={FileText}
                  label="Placa"
                  value={proposta.veiculo_placa}
                  iconColor="text-purple-500"
                />
                <InfoItem
                  icon={Calendar}
                  label="Ano"
                  value={proposta.veiculo_ano?.toString()}
                  iconColor="text-purple-500"
                />
                <InfoItem
                  icon={FileText}
                  label="Cor"
                  value={proposta.veiculo_cor}
                  iconColor="text-purple-500"
                />
              </div>
              
              {/* Alerta de campos obrigatórios para SGA */}
              {(!proposta.veiculo_renavam && !veiculoRenavam) || (!proposta.veiculo_chassi && !veiculoChassi) ? (
                <div className="rounded-lg border border-warning/50 bg-warning/10 p-4">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="h-5 w-5 text-warning flex-shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <h4 className="font-semibold text-warning">Campos obrigatórios para SGA Hinova</h4>
                      <p className="text-sm text-muted-foreground mt-1">
                        Preencha {[
                          !proposta.veiculo_renavam && !veiculoRenavam ? 'RENAVAM' : '',
                          !proposta.veiculo_chassi && !veiculoChassi ? 'CHASSI' : ''
                        ].filter(Boolean).join(' e ')} para enviar ao SGA.
                      </p>
                    </div>
                  </div>
                </div>
              ) : null}
              
              {/* Campos Editáveis RENAVAM e CHASSI */}
              <div className="grid gap-4 sm:grid-cols-2 pt-2">
                <div className="space-y-2">
                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    RENAVAM
                  </label>
                  {proposta.veiculo_renavam ? (
                    <p className="text-sm font-medium text-foreground">{proposta.veiculo_renavam}</p>
                  ) : (
                    <input
                      type="text"
                      value={veiculoRenavam}
                      onChange={(e) => setVeiculoRenavam(e.target.value.replace(/\D/g, ''))}
                      placeholder="Digite o RENAVAM"
                      maxLength={11}
                      className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    />
                  )}
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    CHASSI
                  </label>
                  {proposta.veiculo_chassi ? (
                    <p className="text-sm font-medium text-foreground">{proposta.veiculo_chassi}</p>
                  ) : (
                    <input
                      type="text"
                      value={veiculoChassi}
                      onChange={(e) => setVeiculoChassi(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
                      placeholder="Digite o CHASSI"
                      maxLength={17}
                      className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    />
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Instalação Agendada (pré-instalação - com badge de encaixe) */}
          {proposta.instalacao_agendada && !proposta.instalacao_info && (
            <Card className="border-border bg-card border-2 border-info/30">
              <CardHeader className="bg-info/10">
                <CardTitle className="flex items-center gap-2 text-foreground">
                  <Calendar className="h-5 w-5 text-info" />
                  Instalação Agendada
                </CardTitle>
                <CardDescription>
                  Agendamento realizado pelo cliente após pagamento da adesão
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-4 space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <InfoItem
                    icon={Calendar}
                    label="Data Agendada"
                    value={format(new Date(proposta.instalacao_agendada.data), "dd/MM/yyyy", { locale: ptBR })}
                    highlight
                    iconColor="text-info"
                  />
                  <InfoItem
                    icon={Clock}
                    label="Horário"
                    value={proposta.instalacao_agendada.horario}
                    iconColor="text-info"
                  />
                </div>
                
                {/* Badge de Encaixe Permitido */}
                {proposta.instalacao_agendada.permite_encaixe && (
                  <div className="flex items-center gap-3 p-4 rounded-lg bg-primary/10 border border-primary/30">
                    <div className="p-2 rounded-full bg-primary/20">
                      <Puzzle className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <span className="font-semibold text-primary">Encaixe Permitido</span>
                      <p className="text-sm text-muted-foreground">
                        Cliente autorizou atendimento antecipado se houver vistoriador próximo
                      </p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Vistoria na Base Realizada */}
          {proposta.vistoria_base_info && (
            <Card className="border-border bg-card border-2 border-green-500/30">
              <CardHeader className="bg-green-500/10">
                <CardTitle className="flex items-center gap-2 text-foreground">
                  <Building2 className="h-5 w-5 text-green-500" />
                  Vistoria na Base
                </CardTitle>
                <CardDescription>
                  Cliente compareceu à base PRATIC para realizar a vistoria presencial
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-4 grid gap-4 sm:grid-cols-2">
                <InfoItem
                  icon={Calendar}
                  label="Data da Vistoria"
                  value={format(new Date(proposta.vistoria_base_info.data_agendada + 'T00:00:00'), "dd/MM/yyyy", { locale: ptBR })}
                  highlight
                  iconColor="text-green-500"
                />
                <InfoItem
                  icon={Clock}
                  label="Horário"
                  value={proposta.vistoria_base_info.horario}
                  iconColor="text-green-500"
                />
                <InfoItem
                  icon={User}
                  label="Atendido por"
                  value={proposta.vistoria_base_info.atendido_por_nome}
                  iconColor="text-green-500"
                />
                <div className="flex items-center gap-2">
                  <Badge className="bg-green-500/20 text-green-500 border-green-500/30">
                    <CheckCircle className="h-3 w-3 mr-1" />
                    Vistoria Realizada
                  </Badge>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Dados da Instalação e Rastreador */}
          {proposta.instalacao_info && (
            <Card className="border-border bg-card border-2 border-purple-500/30">
              <CardHeader className="bg-purple-500/10">
                <CardTitle className="flex items-center gap-2 text-foreground">
                  <Wifi className="h-5 w-5 text-purple-500" />
                  Dados da Instalação
                </CardTitle>
                <CardDescription>
                  Informações preenchidas pelo instalador durante a instalação do rastreador
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-4 grid gap-4 sm:grid-cols-2">
                <InfoItem
                  icon={Smartphone}
                  label="IMEI do Rastreador"
                  value={proposta.instalacao_info.rastreador_imei}
                  highlight
                  iconColor="text-blue-500"
                />
                <InfoItem
                  icon={Hash}
                  label="Código do Rastreador"
                  value={proposta.instalacao_info.rastreador_codigo}
                  iconColor="text-blue-500"
                />
                <InfoItem
                  icon={Calendar}
                  label="Data da Instalação"
                  value={
                    proposta.instalacao_info.concluida_em
                      ? format(new Date(proposta.instalacao_info.concluida_em), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })
                      : null
                  }
                  iconColor="text-blue-500"
                />
                <InfoItem
                  icon={Wrench}
                  label="Instalador Responsável"
                  value={proposta.instalacao_info.instalador_nome}
                  iconColor="text-blue-500"
                />
              </CardContent>
            </Card>
          )}

          {/* Assinatura do Cliente */}
          {proposta.instalacao_info?.assinatura_cliente_url && (
            <AssinaturaClienteCard 
              assinaturaUrl={proposta.instalacao_info.assinatura_cliente_url}
              dataColeta={proposta.instalacao_info.concluida_em}
              instaladorNome={proposta.instalacao_info.instalador_nome}
            />
          )}

          <Card className="border-border bg-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-foreground">
                <FileCheck className="h-5 w-5 text-purple-500" />
                Dados do Contrato
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <InfoItem
                icon={FileText}
                label="Número do Contrato"
                value={proposta.numero}
                iconColor="text-emerald-500"
              />
              <InfoItem
                icon={FileCheck}
                label="Plano Escolhido"
                value={proposta.plano?.nome || proposta.plano_nome}
                highlight
                iconColor="text-emerald-500"
              />
              <InfoItem
                icon={DollarSign}
                label="Valor Mensal"
                value={formatCurrency(proposta.valor_mensal)}
                highlight
                iconColor="text-emerald-500"
              />
              {/* Dia de Vencimento removido - não exibido ao Analista de Cadastro */}
              <InfoItem
                icon={Calendar}
                label="Data de Assinatura"
                value={
                  proposta.data_assinatura
                    ? format(new Date(proposta.data_assinatura), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })
                    : null
                }
                iconColor="text-emerald-500"
              />
              <InfoItem
                icon={User}
                label="Vendedor"
                value={proposta.vendedor?.nome}
                iconColor="text-emerald-500"
              />
            </CardContent>
          </Card>
        </div>

        {/* COLUNA DIREITA - 40% */}
        <div className="lg:col-span-2 space-y-6">
          {/* Status Card */}
          <Card className="border-border bg-card">
            <CardHeader className="text-center pb-2">
              <CardTitle className="text-foreground">Status da Proposta</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col items-center gap-4 pt-4">
              <div className="scale-110">
                <StatusBadge status={proposta.status} />
              </div>
              {proposta.status === 'assinado' && (
                <p className="text-sm text-muted-foreground text-center max-w-xs">
                  Esta proposta está aguardando sua análise e aprovação.
                </p>
              )}
            </CardContent>
          </Card>

          {/* Documentos Solicitados (Pendência Resolvida) */}
          {proposta.documentos_solicitados_enviados && proposta.documentos_solicitados_enviados.length > 0 && (
            <DocumentosSolicitadosCard 
              documentosSolicitados={proposta.documentos_solicitados_enviados} 
            />
          )}

          {/* Documentos Anexados */}
          <DocumentosAnexadosCard documentos={proposta.documentos || []} />

          {/* Fotos da Vistoria */}
          {proposta.vistoria && (
            <VistoriaFotosCard 
              fotos={proposta.vistoria.fotos || []} 
              vistoriaStatus={proposta.vistoria.status}
              modalidade={proposta.vistoria.modalidade}
            />
          )}

          {/* Observações do Vistoriador */}
          {proposta.vistoria && (proposta.vistoria.observacoes || proposta.vistoria.km_atual) && (
            <VistoriaObservacoesCard 
              observacoes={proposta.vistoria.observacoes}
              kmAtual={proposta.vistoria.km_atual}
            />
          )}

          {/* Ações */}
          <Card className="border-border bg-card">
            <CardHeader className="text-center pb-2">
              <CardTitle className="text-foreground">Ações</CardTitle>
              <CardDescription className="text-center">
                {proposta.status === 'assinado' && !proposta.tem_documento_pendente
                  ? 'Analise os dados e tome uma decisão'
                  : 'Ações indisponíveis no momento'}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 pt-4">
              {proposta.status === 'assinado' && !proposta.tem_documento_pendente ? (
                <>
                  {(() => {
                    // Vistoria na base NÃO é autovistoria (fotos são do vistoriador)
                    const isVistoriaBase = !!proposta.vistoria_base_info;
                    
                    // Autovistoria = modalidade explícita 'autovistoria' E ainda não tem instalação
                    // E não é vistoria na base
                    const isAutovistoria = (
                      proposta.vistoria?.modalidade === 'autovistoria' ||
                      proposta.vistoria?.tipo === 'autovistoria'
                    ) && !proposta.instalacao_info && !isVistoriaBase;
                    return (
                      <Button
                        className="w-full bg-success hover:bg-success/90 text-white"
                        size="lg"
                        onClick={handleAprovar}
                        disabled={aprovarMutation.isPending}
                      >
                        {isAutovistoria ? (
                          <ShieldCheck className="mr-2 h-5 w-5" />
                        ) : (
                          <CheckCircle className="mr-2 h-5 w-5" />
                        )}
                        {aprovarMutation.isPending 
                          ? 'Aprovando...' 
                          : isAutovistoria 
                            ? 'Aprovar Cobertura de Roubo e Furto' 
                            : 'Aprovar Proposta'
                        }
                      </Button>
                    );
                  })()}

                  <Button
                    variant="outline"
                    className="w-full border-warning text-warning hover:bg-warning/10"
                    size="lg"
                    onClick={() => setShowSolicitarDocs(true)}
                  >
                    <FileText className="mr-2 h-5 w-5" />
                    Solicitar Documentos
                  </Button>

                  <Button
                    variant="outline"
                    className="w-full border-destructive text-destructive hover:bg-destructive/10"
                    size="lg"
                    onClick={() => setShowReprovar(true)}
                  >
                    <XCircle className="mr-2 h-5 w-5" />
                    Reprovar Proposta
                  </Button>

                </>
              ) : (
                <div className="text-center py-4 space-y-3">
                  {proposta.tem_documento_pendente && (
                    <div className="flex items-center justify-center gap-2 text-warning">
                      <Clock className="h-5 w-5" />
                      <span className="text-sm font-medium">
                        Aguardando envio de documentos pelo cliente
                      </span>
                    </div>
                  )}
                  {proposta.status === 'ativo' && (
                    <>
                      <div className="flex items-center justify-center gap-2 text-success">
                        <CheckCircle className="h-5 w-5" />
                        <span className="text-sm font-medium">
                          Esta proposta já foi aprovada
                        </span>
                      </div>
                      
                      {/* Botão de ativação Softruck */}
                      {podeAtivarSoftruck && (
                        <div className="mt-4 space-y-3">
                          <div className="bg-warning/10 border border-warning/30 rounded-lg p-3">
                            <div className="flex items-start gap-2">
                              <AlertTriangle className="h-5 w-5 text-warning mt-0.5" />
                              <div>
                                <p className="font-medium text-warning">Ativação Pendente</p>
                                <p className="text-sm text-muted-foreground">
                                  O rastreador foi instalado mas ainda não foi ativado na plataforma Softruck.
                                </p>
                              </div>
                            </div>
                          </div>
                          
                          <Button
                            className="w-full bg-primary hover:bg-primary/90 text-primary-foreground"
                            size="lg"
                            onClick={() => setShowConfirmAtivacaoSoftruck(true)}
                            disabled={isAtivandoSoftruck}
                          >
                            {isAtivandoSoftruck ? (
                              <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Ativando na Softruck...
                              </>
                            ) : (
                              <>
                                <Zap className="mr-2 h-4 w-4" />
                                Ativar Rastreador Softruck
                              </>
                            )}
                          </Button>
                        </div>
                      )}
                    </>
                  )}
                  {proposta.status === 'reprovado' && (
                    <div className="flex items-center justify-center gap-2 text-destructive">
                      <XCircle className="h-5 w-5" />
                      <span className="text-sm font-medium">
                        Esta proposta foi reprovada
                      </span>
                    </div>
                  )}
                  {proposta.status === 'em_analise' && !proposta.tem_documento_pendente && (
                    <div className="flex items-center justify-center gap-2 text-info">
                      <Clock className="h-5 w-5" />
                      <span className="text-sm font-medium">
                        Esta proposta está em análise
                      </span>
                    </div>
                  )}
                </div>
              )}

              <Separator className="my-4" />

              <Button
                variant="ghost"
                className="w-full"
                onClick={() => navigate('/cadastro/propostas')}
              >
                <ArrowLeft className="mr-2 h-4 w-4" />
                Voltar para Lista
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* DIALOGS */}
      <SolicitarDocumentosDialog
        open={showSolicitarDocs}
        onOpenChange={setShowSolicitarDocs}
        onConfirm={handleSolicitarDocumentos}
        loading={solicitarDocsMutation.isPending}
      />

      <ReprovarPropostaDialog
        open={showReprovar}
        onOpenChange={setShowReprovar}
        onConfirm={handleReprovar}
        loading={reprovarMutation.isPending}
      />

      {/* Dialog de confirmação de aprovação */}
      {(() => {
        // Vistoria na base NÃO é autovistoria (fotos são do vistoriador)
        const isVistoriaBase = !!proposta.vistoria_base_info;
        
        // Autovistoria = modalidade explícita 'autovistoria' E ainda não tem instalação
        // E não é vistoria na base
        const isAutovistoria = (
          proposta.vistoria?.modalidade === 'autovistoria' ||
          proposta.vistoria?.tipo === 'autovistoria'
        ) && !proposta.instalacao_info && !isVistoriaBase;
        
        return (
          <AlertDialog open={showConfirmAprovar} onOpenChange={setShowConfirmAprovar}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle className="flex items-center gap-2">
                  {isAutovistoria ? (
                    <ShieldCheck className="h-5 w-5 text-success" />
                  ) : (
                    <CheckCircle className="h-5 w-5 text-success" />
                  )}
                  {isAutovistoria 
                    ? 'Confirmar Liberação de Cobertura'
                    : 'Confirmar Aprovação'
                  }
                </AlertDialogTitle>
                <AlertDialogDescription asChild>
                  {isAutovistoria ? (
                    <div className="space-y-3">
                      <p>Ao aprovar, o sistema irá <strong>liberar apenas a cobertura de roubo e furto</strong>:</p>
                      
                      <div className="bg-success/10 border border-success/30 rounded-lg p-3 space-y-2">
                        <div className="flex items-center gap-2 text-sm">
                          <div className="w-6 h-6 rounded-full bg-success/20 flex items-center justify-center">
                            <ShieldCheck className="h-3 w-3 text-success" />
                          </div>
                          <span>Ativar cobertura de <strong>Roubo e Furto</strong></span>
                        </div>
                      </div>
                      
                      <div className="bg-muted rounded-lg p-3 space-y-2">
                        <p className="text-sm font-medium text-muted-foreground">
                          Pendente (após instalação do rastreador):
                        </p>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <ShieldOff className="h-3 w-3" />
                          <span>Cobertura Total</span>
                        </div>
                      </div>
                      
                      <p className="text-sm text-muted-foreground">
                        A cobertura total será ativada automaticamente após a instalação e ativação do rastreador.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <p>Ao aprovar esta proposta, o sistema irá:</p>
                      
                      <div className="bg-muted rounded-lg p-3 space-y-2">
                        <div className="flex items-center gap-2 text-sm">
                          <div className="w-6 h-6 rounded-full bg-success/20 flex items-center justify-center">
                            <User className="h-3 w-3 text-success" />
                          </div>
                          <span>Ativar o associado no sistema</span>
                        </div>
                        
                        
                        <div className="flex items-center gap-2 text-sm">
                          <div className="w-6 h-6 rounded-full bg-purple-500/20 flex items-center justify-center">
                            <Smartphone className="h-3 w-3 text-purple-500" />
                          </div>
                          <span>Liberar acesso ao App do Associado</span>
                        </div>
                      </div>
                      
                      <p className="text-sm text-muted-foreground">
                        O cliente receberá uma notificação sobre a aprovação.
                      </p>
                    </div>
                  )}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleConfirmarAprovacao}
                  className="bg-success hover:bg-success/90 text-white"
                  disabled={aprovarMutation.isPending}
                >
                  {isAutovistoria ? (
                    <ShieldCheck className="h-4 w-4 mr-2" />
                  ) : (
                    <CheckCircle className="h-4 w-4 mr-2" />
                  )}
                  {aprovarMutation.isPending 
                    ? 'Aprovando...' 
                    : isAutovistoria
                      ? 'Liberar Cobertura de Roubo e Furto'
                      : 'Confirmar Aprovação'
                  }
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        );
      })()}

      {/* Dialog de confirmação de ativação Softruck */}
      <AlertDialog open={showConfirmAtivacaoSoftruck} onOpenChange={setShowConfirmAtivacaoSoftruck}>
        <AlertDialogContent className="bg-card border-border">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-foreground">
              <Zap className="h-5 w-5 text-primary" />
              Confirmar Ativação do Rastreador
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3 text-muted-foreground">
                <p>Esta ação irá:</p>
                <ul className="list-disc list-inside space-y-1 text-sm">
                  <li>Ativar o rastreador na plataforma <strong className="text-foreground">SOFTRUCK</strong></li>
                  <li>Liberar a <strong className="text-foreground">cobertura total</strong> para o veículo {proposta?.veiculo_placa}</li>
                  <li>Criar veículo/device na Softruck se necessário</li>
                </ul>
                <p className="font-medium text-foreground">Deseja continuar?</p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-border">Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-primary hover:bg-primary/90 text-primary-foreground"
              onClick={handleConfirmarAtivacaoSoftruck}
              disabled={isAtivandoSoftruck}
            >
              {isAtivandoSoftruck ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Ativando...
                </>
              ) : (
                <>
                  <Zap className="mr-2 h-4 w-4" />
                  Confirmar Ativação
                </>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
