import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
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
} from 'lucide-react';
import {
  useProposta,
  usePropostasPendentes,
  useAprovarProposta,
  useSolicitarDocumentos,
  useReprovarProposta,
} from '@/hooks/usePropostasPendentes';
import { SolicitarDocumentosDialog } from '@/components/cadastro/SolicitarDocumentosDialog';
import { DocumentosAnexadosCard } from '@/components/cadastro/DocumentosAnexadosCard';
import { DocumentosSolicitadosCard } from '@/components/cadastro/DocumentosSolicitadosCard';
import { VistoriaFotosCard } from '@/components/cadastro/VistoriaFotosCard';
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
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string | null | undefined;
  highlight?: boolean;
}) {
  return (
    <div className="flex items-start gap-3">
      <div className="p-2 rounded-lg bg-muted">
        <Icon className="h-4 w-4 text-muted-foreground" />
      </div>
      <div>
        <p className="text-sm text-muted-foreground">{label}</p>
        <p className={cn("text-foreground", highlight && "font-semibold text-lg")}>
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

  const [showSolicitarDocs, setShowSolicitarDocs] = useState(false);
  const [showReprovar, setShowReprovar] = useState(false);
  const [showConfirmAprovar, setShowConfirmAprovar] = useState(false);

  const { data: proposta, isLoading } = useProposta(id);
  const { data: todasPropostas } = usePropostasPendentes();

  const aprovarMutation = useAprovarProposta();
  const solicitarDocsMutation = useSolicitarDocumentos();
  const reprovarMutation = useReprovarProposta();

  // Encontrar próxima proposta
  const currentIndex = todasPropostas?.findIndex((p) => p.id === id) ?? -1;
  const nextProposta = currentIndex >= 0 && todasPropostas ? todasPropostas[currentIndex + 1] : null;

  const handleAprovar = () => {
    setShowConfirmAprovar(true);
  };

  const handleConfirmarAprovacao = async () => {
    if (!id) return;
    setShowConfirmAprovar(false);
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
    <div className="space-y-6">
      {/* HEADER */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
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
              />
              <InfoItem
                icon={FileText}
                label="CPF"
                value={maskCPF(proposta.cliente_cpf || associado?.cpf)}
              />
              <InfoItem
                icon={Phone}
                label="Telefone"
                value={proposta.cliente_telefone || associado?.telefone}
              />
              <InfoItem
                icon={Mail}
                label="Email"
                value={proposta.cliente_email || associado?.email}
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
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <InfoItem
                icon={Car}
                label="Modelo/Marca"
                value={`${proposta.veiculo_modelo || '---'} ${proposta.veiculo_marca || ''}`}
                highlight
              />
              <InfoItem
                icon={FileText}
                label="Placa"
                value={proposta.veiculo_placa}
              />
              <InfoItem
                icon={Calendar}
                label="Ano"
                value={proposta.veiculo_ano?.toString()}
              />
              <InfoItem
                icon={FileText}
                label="Cor"
                value={proposta.veiculo_cor}
              />
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
                  />
                  <InfoItem
                    icon={Clock}
                    label="Horário"
                    value={proposta.instalacao_agendada.horario}
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
                />
                <InfoItem
                  icon={Hash}
                  label="Código do Rastreador"
                  value={proposta.instalacao_info.rastreador_codigo}
                />
                <InfoItem
                  icon={Calendar}
                  label="Data da Instalação"
                  value={
                    proposta.instalacao_info.concluida_em
                      ? format(new Date(proposta.instalacao_info.concluida_em), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })
                      : null
                  }
                />
                <InfoItem
                  icon={Wrench}
                  label="Instalador Responsável"
                  value={proposta.instalacao_info.instalador_nome}
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
              />
              <InfoItem
                icon={FileCheck}
                label="Plano Escolhido"
                value={proposta.plano?.nome || proposta.plano_nome}
                highlight
              />
              <InfoItem
                icon={DollarSign}
                label="Valor Mensal"
                value={formatCurrency(proposta.valor_mensal)}
                highlight
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
              />
              <InfoItem
                icon={User}
                label="Vendedor"
                value={proposta.vendedor?.nome}
              />
            </CardContent>
          </Card>
        </div>

        {/* COLUNA DIREITA - 40% */}
        <div className="lg:col-span-2 space-y-6">
          {/* Status Card */}
          <Card className="border-border bg-card">
            <CardHeader>
              <CardTitle className="text-foreground">Status da Proposta</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col items-center gap-4">
              <StatusBadge status={proposta.status} />
              {proposta.status === 'assinado' && (
                <p className="text-sm text-muted-foreground text-center">
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

          {/* Fotos da Auto Vistoria */}
          {proposta.vistoria && (
            <VistoriaFotosCard 
              fotos={proposta.vistoria.fotos || []} 
              vistoriaStatus={proposta.vistoria.status}
            />
          )}

          {/* Ações */}
          <Card className="border-border bg-card">
            <CardHeader>
              <CardTitle className="text-foreground">Ações</CardTitle>
              <CardDescription>
                {proposta.status === 'assinado' && !proposta.tem_documento_pendente
                  ? 'Analise os dados e tome uma decisão'
                  : 'Ações indisponíveis no momento'}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {proposta.status === 'assinado' && !proposta.tem_documento_pendente ? (
                <>
                  <Button
                    className="w-full bg-success hover:bg-success/90 text-white"
                    size="lg"
                    onClick={handleAprovar}
                    disabled={aprovarMutation.isPending}
                  >
                    <CheckCircle className="mr-2 h-5 w-5" />
                    {aprovarMutation.isPending ? 'Aprovando...' : 'Aprovar Proposta'}
                  </Button>

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
                    <div className="flex items-center justify-center gap-2 text-success">
                      <CheckCircle className="h-5 w-5" />
                      <span className="text-sm font-medium">
                        Esta proposta já foi aprovada
                      </span>
                    </div>
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
      <AlertDialog open={showConfirmAprovar} onOpenChange={setShowConfirmAprovar}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-success" />
              Confirmar Aprovação
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
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
                    <div className="w-6 h-6 rounded-full bg-info/20 flex items-center justify-center">
                      <Wrench className="h-3 w-3 text-info" />
                    </div>
                    <span>Criar instalação pendente (rastreador)</span>
                  </div>
                  
                  <div className="flex items-center gap-2 text-sm">
                    <div className="w-6 h-6 rounded-full bg-warning/20 flex items-center justify-center">
                      <CreditCard className="h-3 w-3 text-warning" />
                    </div>
                    <span>Gerar primeira cobrança</span>
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
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmarAprovacao}
              className="bg-success hover:bg-success/90 text-white"
              disabled={aprovarMutation.isPending}
            >
              <CheckCircle className="h-4 w-4 mr-2" />
              {aprovarMutation.isPending ? 'Aprovando...' : 'Confirmar Aprovação'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
