import { useParams, useNavigate, Link } from 'react-router-dom';
import { useContrato, useContratoActions } from '@/hooks/useContratos';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
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
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
  ArrowLeft,
  Send,
  Download,
  XCircle,
  User,
  Car,
  DollarSign,
  Phone,
  Mail,
  Calendar,
  Tag,
  Shield,
  Check,
  AlertCircle,
  FileText,
  Clock,
  Eye,
  PenLine,
  CheckCircle2,
  Link2,
  ExternalLink,
  Copy,
  Camera,
} from 'lucide-react';
import { useGerarLinkAssociado, getAssociadoLinkUrl } from '@/hooks/useContratoLink';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import {
  STATUS_CONTRATO_LABELS,
  STATUS_CONTRATO_COLORS,
} from '@/types/vendas';
import type { StatusContrato } from '@/types/vendas';
import type { LucideIcon } from 'lucide-react';

// ============================================
// UTILITÁRIOS
// ============================================
const formatCurrency = (value: number | null | undefined) => {
  if (value == null) return '—';
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
};

const formatPhone = (phone: string | null | undefined) => {
  if (!phone) return '—';
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 11) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  }
  return phone;
};

const formatCPF = (cpf: string | null | undefined) => {
  if (!cpf) return '—';
  const digits = cpf.replace(/\D/g, '');
  if (digits.length === 11) {
    return `***.${digits.slice(3, 6)}.***-${digits.slice(9)}`;
  }
  return cpf;
};

const formatDate = (date: string) => {
  return new Date(date).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
};

const formatDateTime = (date: string) => {
  return new Date(date).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

// Coberturas mock por plano
const COBERTURAS_POR_PLANO: Record<string, string[]> = {
  basico: [
    'Proteção contra roubo/furto',
    'Proteção contra colisão',
    'Proteção contra incêndio',
    'Assistência 24h',
  ],
  completo: [
    'Proteção contra roubo/furto',
    'Proteção contra colisão',
    'Proteção contra incêndio',
    'Assistência 24h',
    'Proteção de vidros',
    'App de rastreamento',
    'Carro reserva (7 dias)',
  ],
  premium: [
    'Proteção contra roubo/furto',
    'Proteção contra colisão',
    'Proteção contra incêndio',
    'Assistência 24h Premium',
    'Proteção de vidros',
    'App de rastreamento',
    'Carro reserva (15 dias)',
    'Proteção para terceiros',
    'Desconto em rede credenciada',
  ],
};

interface TimelineEvento {
  id: number;
  tipo: string;
  descricao: string;
  data: string | null;
  icone: LucideIcon;
  cor: string;
  bgCor: string;
  concluido: boolean;
}

// Gerar timeline dinâmica baseada no status
const gerarTimeline = (contrato: any): TimelineEvento[] => {
  const eventos: TimelineEvento[] = [];
  const createdAt = new Date(contrato.created_at);
  let eventId = 1;
  
  // 1. Criação
  eventos.push({
    id: eventId++,
    tipo: 'criacao',
    descricao: `Contrato gerado por ${contrato.vendedor?.nome || 'Sistema'}`,
    data: createdAt.toISOString(),
    icone: FileText,
    cor: 'text-blue-500',
    bgCor: 'bg-blue-100',
    concluido: true,
  });

  // 2. Link gerado
  if (contrato.link_gerado_em) {
    eventos.push({
      id: eventId++,
      tipo: 'link_gerado',
      descricao: 'Link do associado gerado',
      data: contrato.link_gerado_em,
      icone: Link2,
      cor: 'text-blue-500',
      bgCor: 'bg-blue-100',
      concluido: true,
    });
  }

  // 3. Tipo de vistoria selecionado
  if (contrato.tipo_vistoria) {
    eventos.push({
      id: eventId++,
      tipo: 'vistoria_tipo',
      descricao: `Tipo selecionado: ${contrato.tipo_vistoria === 'agendada' ? 'Vistoria Agendada' : 'Autovistoria'}`,
      data: null,
      icone: contrato.tipo_vistoria === 'agendada' ? Calendar : Camera,
      cor: 'text-purple-500',
      bgCor: 'bg-purple-100',
      concluido: true,
    });
  }

  // 4. Adesão paga
  if (contrato.adesao_paga) {
    eventos.push({
      id: eventId++,
      tipo: 'adesao_paga',
      descricao: 'Adesão paga pelo associado',
      data: contrato.adesao_paga_em,
      icone: DollarSign,
      cor: 'text-green-500',
      bgCor: 'bg-green-100',
      concluido: true,
    });
  }

  // 5. Envio para assinatura (se status >= enviado)
  if (['enviado', 'assinado', 'ativo'].includes(contrato.status)) {
    const envioDate = new Date(createdAt.getTime() + 5 * 60 * 1000);
    eventos.push({
      id: eventId++,
      tipo: 'envio',
      descricao: 'Enviado para assinatura via Autentique',
      data: envioDate.toISOString(),
      icone: Send,
      cor: 'text-purple-500',
      bgCor: 'bg-purple-100',
      concluido: true,
    });
  }

  // 6. Visualização (mock)
  if (['assinado', 'ativo'].includes(contrato.status)) {
    const vizDate = new Date(createdAt.getTime() + 4 * 60 * 60 * 1000);
    eventos.push({
      id: eventId++,
      tipo: 'visualizacao',
      descricao: 'Visualizado pelo cliente',
      data: vizDate.toISOString(),
      icone: Eye,
      cor: 'text-yellow-500',
      bgCor: 'bg-yellow-100',
      concluido: true,
    });
  }

  // 7. Assinatura
  if (['assinado', 'ativo'].includes(contrato.status)) {
    const assDate = new Date(createdAt.getTime() + 5 * 60 * 60 * 1000);
    eventos.push({
      id: eventId++,
      tipo: 'assinatura',
      descricao: 'Assinado pelo cliente',
      data: assDate.toISOString(),
      icone: PenLine,
      cor: 'text-green-500',
      bgCor: 'bg-green-100',
      concluido: true,
    });
  }

  // 8. Ativação
  if (contrato.status === 'ativo') {
    const ativoDate = new Date(createdAt.getTime() + 6 * 60 * 60 * 1000);
    eventos.push({
      id: eventId++,
      tipo: 'ativacao',
      descricao: 'Contrato ativado',
      data: ativoDate.toISOString(),
      icone: CheckCircle2,
      cor: 'text-green-600',
      bgCor: 'bg-green-100',
      concluido: true,
    });
  }

  // Eventos pendentes
  if (contrato.status === 'pendente' || contrato.status === 'rascunho') {
    // Aguardando link
    if (!contrato.link_gerado_em) {
      eventos.push({
        id: eventId++,
        tipo: 'aguardando_link',
        descricao: 'Aguardando geração do link do associado',
        data: null,
        icone: Clock,
        cor: 'text-muted-foreground',
        bgCor: 'bg-muted',
        concluido: false,
      });
    } else if (!contrato.tipo_vistoria) {
      // Aguardando seleção de vistoria
      eventos.push({
        id: eventId++,
        tipo: 'aguardando_vistoria',
        descricao: 'Aguardando associado selecionar tipo de vistoria',
        data: null,
        icone: Clock,
        cor: 'text-muted-foreground',
        bgCor: 'bg-muted',
        concluido: false,
      });
    } else if (!contrato.adesao_paga) {
      // Aguardando pagamento
      eventos.push({
        id: eventId++,
        tipo: 'aguardando_pagamento',
        descricao: 'Aguardando pagamento da adesão',
        data: null,
        icone: Clock,
        cor: 'text-muted-foreground',
        bgCor: 'bg-muted',
        concluido: false,
      });
    }
  }

  if (contrato.status === 'enviado') {
    eventos.push({
      id: 3,
      tipo: 'assinatura',
      descricao: 'Aguardando assinatura do cliente',
      data: null,
      icone: Clock,
      cor: 'text-muted-foreground',
      bgCor: 'bg-muted',
      concluido: false,
    });
  }

  // Cancelado
  if (contrato.status === 'cancelado') {
    eventos.push({
      id: 99,
      tipo: 'cancelamento',
      descricao: 'Contrato cancelado',
      data: contrato.updated_at,
      icone: XCircle,
      cor: 'text-red-500',
      bgCor: 'bg-red-100',
      concluido: true,
    });
  }

  // Suspenso
  if (contrato.status === 'suspenso') {
    eventos.push({
      id: 98,
      tipo: 'suspensao',
      descricao: 'Contrato suspenso',
      data: contrato.updated_at,
      icone: AlertCircle,
      cor: 'text-orange-500',
      bgCor: 'bg-orange-100',
      concluido: true,
    });
  }

  return eventos;
};

// ============================================
// COMPONENTE PRINCIPAL
// ============================================
export default function ContratoDetalhe() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  // Buscar contrato
  const { data: contrato, isLoading, error } = useContrato(id);

  // Actions
  const { reenviarAssinatura, cancelarContrato, isReenviando, isCancelando } = useContratoActions();
  const gerarLink = useGerarLinkAssociado();

  // ============================================
  // LOADING STATE
  // ============================================
  if (isLoading) {
    return (
      <div className="space-y-6 p-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-40 w-full" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Skeleton className="h-48" />
          <Skeleton className="h-48" />
          <Skeleton className="h-48" />
        </div>
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  // ============================================
  // ERROR STATE
  // ============================================
  if (error || !contrato) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] space-y-4">
        <div className="text-center space-y-2">
          <AlertCircle className="h-12 w-12 text-muted-foreground mx-auto" />
          <h2 className="text-xl font-semibold">Contrato não encontrado</h2>
          <p className="text-muted-foreground">
            O contrato solicitado não existe ou foi removido.
          </p>
          <Button
            variant="outline"
            onClick={() => navigate('/vendas/contratos')}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Voltar para lista
          </Button>
        </div>
      </div>
    );
  }

  const timeline = gerarTimeline(contrato);
  const planoNome = contrato.planos?.nome?.toLowerCase() || 'basico';
  const coberturas = COBERTURAS_POR_PLANO[planoNome] || COBERTURAS_POR_PLANO.basico;
  const cliente = contrato.associados || contrato.leads;
  const numeroContrato = contrato.numero || `CTR-${contrato.id.slice(0, 8).toUpperCase()}`;
  
  // Dados do veículo vêm do próprio contrato (com fallback para cotação/lead)
  const veiculoMarca = contrato.veiculo_marca || contrato.cotacoes?.veiculo_marca || contrato.leads?.veiculo_marca;
  const veiculoModelo = contrato.veiculo_modelo || contrato.cotacoes?.veiculo_modelo || contrato.leads?.veiculo_modelo;
  const veiculoAno = contrato.veiculo_ano || contrato.cotacoes?.veiculo_ano || contrato.leads?.veiculo_ano;
  const veiculoPlaca = contrato.veiculo_placa || contrato.leads?.veiculo_placa;
  const veiculoCor = contrato.veiculo_cor;
  const veiculoRenavam = contrato.veiculo_renavam;
  const veiculoValorFipe = contrato.veiculo_valor_fipe || contrato.cotacoes?.valor_fipe;

  // ============================================
  // RENDER
  // ============================================
  return (
    <div className="space-y-6 p-6">
      {/* BREADCRUMB */}
      <nav className="text-sm text-muted-foreground">
        <ol className="flex items-center gap-2">
          <li>
            <Link to="/dashboard" className="hover:text-foreground">
              Home
            </Link>
          </li>
          <li>/</li>
          <li>
            <Link to="/vendas/dashboard" className="hover:text-foreground">
              Vendas
            </Link>
          </li>
          <li>/</li>
          <li>
            <Link to="/vendas/contratos" className="hover:text-foreground">
              Contratos
            </Link>
          </li>
          <li>/</li>
          <li className="text-foreground">{numeroContrato}</li>
        </ol>
      </nav>

      {/* BOTÃO VOLTAR */}
      <div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate('/vendas/contratos')}
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Voltar
        </Button>
      </div>

      {/* HEADER DO CONTRATO */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
            {/* Info principal */}
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-bold">
                  Contrato #{numeroContrato}
                </h1>
                <Badge className={cn(STATUS_CONTRATO_COLORS[contrato.status as StatusContrato])}>
                  {STATUS_CONTRATO_LABELS[contrato.status as StatusContrato]}
                </Badge>
              </div>
              <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Calendar className="h-4 w-4" />
                  Criado em {formatDateTime(contrato.created_at)}
                </span>
                {contrato.status === 'assinado' || contrato.status === 'ativo' ? (
                  <span className="flex items-center gap-1">
                    <PenLine className="h-4 w-4" />
                    Assinado
                  </span>
                ) : null}
              </div>
            </div>

            {/* Ações */}
            <div className="flex flex-wrap gap-2">
              {/* Gerar ou Acessar Link do Associado */}
              {(contrato.status === 'pendente' || contrato.status === 'rascunho') && (
                <>
                  {contrato.link_gerado_em ? (
                    <Button
                      variant="outline"
                      onClick={() => {
                        const url = getAssociadoLinkUrl(contrato.link_token);
                        window.open(url, '_blank');
                      }}
                    >
                      <ExternalLink className="h-4 w-4 mr-2" />
                      Acessar Link do Associado
                    </Button>
                  ) : (
                    <Button
                      variant="default"
                      onClick={() => gerarLink.mutate(contrato.id)}
                      disabled={gerarLink.isPending}
                    >
                      <Link2 className="h-4 w-4 mr-2" />
                      {gerarLink.isPending ? 'Gerando...' : 'Gerar Link do Associado'}
                    </Button>
                  )}
                </>
              )}
              
              {contrato.autentique_url && (
                <Button
                  variant="outline"
                  onClick={() => window.open(contrato.autentique_url!, '_blank')}
                >
                  <Download className="h-4 w-4 mr-2" />
                  Baixar PDF
                </Button>
              )}

              {contrato.status !== 'cancelado' && (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="outline" className="text-destructive hover:text-destructive">
                      <XCircle className="h-4 w-4 mr-2" />
                      Cancelar
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Cancelar contrato</AlertDialogTitle>
                      <AlertDialogDescription>
                        Tem certeza que deseja cancelar o contrato{' '}
                        <strong>{numeroContrato}</strong>?
                        <br /><br />
                        Esta ação não pode ser desfeita.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Não, manter</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={() => {
                          cancelarContrato(contrato.id);
                          navigate('/vendas/contratos');
                        }}
                        disabled={isCancelando}
                        className="bg-destructive hover:bg-destructive/90"
                      >
                        {isCancelando ? 'Cancelando...' : 'Sim, cancelar'}
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* GRID DE CARDS */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* CARD: CLIENTE */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <User className="h-4 w-4 text-primary" />
              Cliente
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="font-semibold text-lg">{cliente?.nome || '—'}</p>
            <Separator />
            <div className="space-y-2 text-sm">
              <div className="flex items-start gap-2">
                <Tag className="h-4 w-4 text-muted-foreground mt-0.5" />
                <div>
                  <p className="text-muted-foreground">CPF</p>
                  <p className="font-medium">{formatCPF(cliente?.cpf)}</p>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <Phone className="h-4 w-4 text-muted-foreground mt-0.5" />
                <div>
                  <p className="text-muted-foreground">Telefone</p>
                  <p className="font-medium">{formatPhone(cliente?.telefone)}</p>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <Mail className="h-4 w-4 text-muted-foreground mt-0.5" />
                <div>
                  <p className="text-muted-foreground">Email</p>
                  <p className="font-medium">{cliente?.email || '—'}</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* CARD: VEÍCULO */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Car className="h-4 w-4 text-primary" />
              Veículo
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {veiculoMarca || veiculoPlaca ? (
              <>
                <p className="font-semibold text-lg">
                  {veiculoMarca} {veiculoModelo}
                </p>
                <Separator />
                <div className="space-y-2 text-sm">
                  <div className="flex items-start gap-2">
                    <Calendar className="h-4 w-4 text-muted-foreground mt-0.5" />
                    <div>
                      <p className="text-muted-foreground">Ano</p>
                      <p className="font-medium">{veiculoAno || '—'}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-2">
                    <Tag className="h-4 w-4 text-muted-foreground mt-0.5" />
                    <div>
                      <p className="text-muted-foreground">Placa</p>
                      <p className="font-medium font-mono">{veiculoPlaca || '—'}</p>
                    </div>
                  </div>
                  {veiculoCor && (
                    <div className="flex items-start gap-2">
                      <Car className="h-4 w-4 text-muted-foreground mt-0.5" />
                      <div>
                        <p className="text-muted-foreground">Cor</p>
                        <p className="font-medium">{veiculoCor}</p>
                      </div>
                    </div>
                  )}
                  {veiculoRenavam && (
                    <div className="flex items-start gap-2">
                      <FileText className="h-4 w-4 text-muted-foreground mt-0.5" />
                      <div>
                        <p className="text-muted-foreground">Renavam</p>
                        <p className="font-medium font-mono">{veiculoRenavam}</p>
                      </div>
                    </div>
                  )}
                  <div className="flex items-start gap-2">
                    <DollarSign className="h-4 w-4 text-muted-foreground mt-0.5" />
                    <div>
                      <p className="text-muted-foreground">Valor FIPE</p>
                      <p className="font-medium">{formatCurrency(veiculoValorFipe)}</p>
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <p className="text-muted-foreground text-sm">Sem informações do veículo</p>
            )}
          </CardContent>
        </Card>

        {/* CARD: PLANO */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Shield className="h-4 w-4 text-primary" />
              Plano
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="font-semibold text-lg">{contrato.planos?.nome || 'Plano'}</p>
            <Separator />
            <div className="space-y-2 text-sm">
              <div className="flex items-start gap-2">
                <DollarSign className="h-4 w-4 text-muted-foreground mt-0.5" />
                <div>
                  <p className="text-muted-foreground">Adesão</p>
                  <p className="font-medium">{formatCurrency(contrato.valor_adesao)}</p>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <DollarSign className="h-4 w-4 text-muted-foreground mt-0.5" />
                <div>
                  <p className="text-muted-foreground">Mensalidade</p>
                  <p className="font-medium">{formatCurrency(contrato.valor_mensal)}</p>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <Calendar className="h-4 w-4 text-muted-foreground mt-0.5" />
                <div>
                  <p className="text-muted-foreground">Vigência</p>
                  <p className="font-medium">12 meses</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* CARD: LINK DO ASSOCIADO */}
        {contrato.link_token && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Link2 className="h-4 w-4 text-primary" />
                Link do Associado
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-2 text-sm">
                <div className="flex items-start gap-2">
                  <Calendar className="h-4 w-4 text-muted-foreground mt-0.5" />
                  <div>
                    <p className="text-muted-foreground">Gerado em</p>
                    <p className="font-medium">{contrato.link_gerado_em ? formatDateTime(contrato.link_gerado_em) : '—'}</p>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <Camera className="h-4 w-4 text-muted-foreground mt-0.5" />
                  <div>
                    <p className="text-muted-foreground">Tipo de Vistoria</p>
                    <p className="font-medium">
                      {contrato.tipo_vistoria === 'agendada' ? 'Vistoria Agendada' 
                        : contrato.tipo_vistoria === 'autovistoria' ? 'Autovistoria' 
                        : 'Não selecionado'}
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <DollarSign className="h-4 w-4 text-muted-foreground mt-0.5" />
                  <div>
                    <p className="text-muted-foreground">Adesão</p>
                    <p className={`font-medium ${contrato.adesao_paga ? 'text-green-600' : 'text-orange-600'}`}>
                      {contrato.adesao_paga ? 'Paga' : 'Pendente'}
                    </p>
                  </div>
                </div>
              </div>
              
              {/* Copiar Link */}
              <div className="pt-2 border-t">
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="w-full"
                  onClick={() => {
                    navigator.clipboard.writeText(getAssociadoLinkUrl(contrato.link_token));
                    toast.success('Link copiado!');
                  }}
                >
                  <Copy className="h-4 w-4 mr-2" />
                  Copiar Link
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* TIMELINE */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Clock className="h-4 w-4 text-primary" />
            Timeline do Contrato
          </CardTitle>
          <CardDescription>
            Acompanhe o histórico de eventos do contrato
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-0">
            {timeline.map((evento, index) => {
              const Icon = evento.icone;
              const isLast = index === timeline.length - 1;
              
              return (
                <div key={evento.id} className="flex gap-4">
                  {/* Linha vertical + ícone */}
                  <div className="flex flex-col items-center">
                    <div className={cn(
                      'w-10 h-10 rounded-full flex items-center justify-center',
                      evento.bgCor
                    )}>
                      <Icon className={cn('h-5 w-5', evento.cor)} />
                    </div>
                    {!isLast && (
                      <div className="w-0.5 h-8 bg-border" />
                    )}
                  </div>
                  
                  {/* Conteúdo */}
                  <div className="pb-8">
                    <p className={cn(
                      'font-medium',
                      !evento.concluido && 'text-muted-foreground'
                    )}>
                      {evento.descricao}
                    </p>
                    {evento.data && (
                      <p className="text-sm text-muted-foreground">
                        {formatDateTime(evento.data)}
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* COBERTURAS */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Shield className="h-4 w-4 text-primary" />
            Coberturas do Plano
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {coberturas.map((cobertura, index) => (
              <div key={index} className="flex items-center gap-2">
                <Check className="h-4 w-4 text-green-500 flex-shrink-0" />
                <span className="text-sm">{cobertura}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* VENDEDOR */}
      {contrato.vendedor && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <User className="h-4 w-4 text-primary" />
              Vendedor Responsável
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                <span className="text-sm font-medium text-primary">
                  {contrato.vendedor.nome.charAt(0).toUpperCase()}
                </span>
              </div>
              <div>
                <p className="font-medium">{contrato.vendedor.nome}</p>
                <p className="text-sm text-muted-foreground">{contrato.vendedor.email}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
