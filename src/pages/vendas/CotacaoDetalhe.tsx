import { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useCotacao, useCotacaoActions, useAceitarCotacaoEGerarContrato } from '@/hooks/useCotacoes';
import { useGerarContrato } from '@/hooks/useContratos';
import { useAuth } from '@/contexts/AuthContext';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  ArrowLeft,
  Send,
  MessageSquare,
  FileText,
  User,
  Car,
  Phone,
  Mail,
  Calendar,
  Shield,
  Check,
  AlertCircle,
  ChevronDown,
  ExternalLink,
  Clock,
  FileSignature,
  Loader2,
  Link2,
  RefreshCw,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { BotaoGerarPdf } from '@/components/cotacoes/BotaoGerarPdf';
import { EnviarEmailModal } from '@/components/cotacoes/EnviarEmailModal';
import { VincularLeadModal } from '@/components/cotacoes/VincularLeadModal';
import {
  STATUS_COTACAO_LABELS,
  STATUS_COTACAO_COLORS,
} from '@/types/vendas';
import type { StatusCotacao } from '@/types/vendas';

// ============================================
// UTILITÁRIOS
// ============================================
const formatCurrency = (value: number | null | undefined) => {
  if (!value) return '—';
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

const calcularValidade = (createdAt: string) => {
  const created = new Date(createdAt);
  const validade = new Date(created.getTime() + 7 * 24 * 60 * 60 * 1000);
  return validade;
};

const isExpirada = (createdAt: string) => {
  const validade = calcularValidade(createdAt);
  return new Date() > validade;
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

// ============================================
// COMPONENTE PRINCIPAL
// ============================================
export default function CotacaoDetalhe() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [showVincularModal, setShowVincularModal] = useState(false);
  const queryClient = useQueryClient();

  const { data: cotacao, isLoading, error } = useCotacao(id);
  const { reenviarCotacao, atualizarStatus, isReenviando, isAtualizando } = useCotacaoActions();
  const gerarContrato = useGerarContrato();
  const aceitarEGerar = useAceitarCotacaoEGerarContrato();
  const { profile } = useAuth();

  // Handler WhatsApp - agora também atualiza status e etapa do lead
  const handleWhatsApp = async () => {
    if (!cotacao) return;
    
    const mensagem = `
🚗 *COTAÇÃO DE PROTEÇÃO VEICULAR*

Olá ${cotacao.leads?.nome?.split(' ')[0] || 'Cliente'}!

*Veículo:* ${cotacao.veiculo_marca || ''} ${cotacao.veiculo_modelo || ''} ${cotacao.veiculo_ano || ''}
*Valor FIPE:* ${formatCurrency(cotacao.valor_fipe)}

*Plano:* ${cotacao.planos?.nome || 'Plano Selecionado'}
*Adesão:* ${formatCurrency(cotacao.valor_adesao)}
*Mensalidade:* ${formatCurrency(cotacao.valor_total_mensal)}

_Cotação válida por 7 dias_

Ficou com alguma dúvida? Estou à disposição!
    `.trim();

    const telefone = cotacao.leads?.telefone?.replace(/\D/g, '');
    const url = telefone 
      ? `https://wa.me/55${telefone}?text=${encodeURIComponent(mensagem)}`
      : `https://wa.me/?text=${encodeURIComponent(mensagem)}`;
    
    window.open(url, '_blank');
    
    // Atualizar status da cotação para 'enviada' e etapa do lead
    if (cotacao.status === 'rascunho') {
      atualizarStatus({ id: cotacao.id, status: 'enviada' });
      
      // Atualizar etapa do lead para 'cotacao_enviada'
      if (cotacao.lead_id) {
        const { supabase } = await import('@/integrations/supabase/client');
        await supabase
          .from('leads')
          .update({ etapa: 'cotacao_enviada', updated_at: new Date().toISOString() })
          .eq('id', cotacao.lead_id);
      }
    }
  };

  // Handler mudar status
  const handleMudarStatus = (status: StatusCotacao) => {
    if (!id) return;
    atualizarStatus({ id, status });
  };

  // ============================================
  // LOADING STATE
  // ============================================
  if (isLoading) {
    return (
      <div className="space-y-6 p-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-40 w-full" />
        <div className="grid gap-4 md:grid-cols-2">
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
  if (error || !cotacao) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center p-6">
        <Card className="max-w-md text-center">
          <CardContent className="pt-6">
            <AlertCircle className="mx-auto h-12 w-12 text-destructive" />
            <h2 className="mt-4 text-xl font-semibold">Cotação não encontrada</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              A cotação solicitada não existe ou foi removida.
            </p>
            <Button
              className="mt-4"
              variant="outline"
              onClick={() => navigate('/vendas/cotacoes')}
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Voltar para lista
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const validade = calcularValidade(cotacao.created_at);
  const expirada = isExpirada(cotacao.created_at);
  const planoNome = cotacao.planos?.nome?.toLowerCase() || 'basico';
  const coberturas = COBERTURAS_POR_PLANO[planoNome] || COBERTURAS_POR_PLANO.basico;
  const primeiroPagamento = (cotacao.valor_adesao || 0) + (cotacao.valor_total_mensal || 0);

  // ============================================
  // RENDER
  // ============================================
  return (
    <div className="space-y-6 p-6">
      {/* BREADCRUMB */}
      <nav className="text-sm text-muted-foreground">
        <ol className="flex items-center gap-1">
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
            <Link to="/vendas/cotacoes" className="hover:text-foreground">
              Cotações
            </Link>
          </li>
          <li>/</li>
          <li className="text-foreground font-medium">
            {cotacao.numero || `COT-${cotacao.id.slice(0, 8).toUpperCase()}`}
          </li>
        </ol>
      </nav>

      {/* BOTÃO VOLTAR */}
      <div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate('/vendas/cotacoes')}
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Voltar
        </Button>
      </div>

      {/* HEADER DA COTAÇÃO */}
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            {/* Info principal */}
            <div className="space-y-2">
              {/* Linha 1: Nome do Lead (destaque) + Badge de Status */}
              <div className="flex items-center gap-3">
                <CardTitle className="text-2xl font-bold">
                  {cotacao.leads?.nome || 'Cotação Avulsa'}
                </CardTitle>
                <Badge className={STATUS_COTACAO_COLORS[cotacao.status as StatusCotacao]}>
                  {STATUS_COTACAO_LABELS[cotacao.status as StatusCotacao]}
                </Badge>
              </div>
              
              {/* Linha 2: ID da cotação (texto secundário) */}
              <p className="text-sm text-muted-foreground">
                {cotacao.leads?.nome ? 'Cotação' : ''} #{cotacao.numero || cotacao.id.slice(0, 8).toUpperCase()}
              </p>
              
              {/* Linha 3: Datas */}
              <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Calendar className="h-4 w-4" />
                  Criada em {formatDateTime(cotacao.created_at)}
                </span>
                <span className={cn("flex items-center gap-1", expirada && "text-destructive")}>
                  <Clock className="h-4 w-4" />
                  {expirada ? 'Expirada em' : 'Válida até'} {formatDate(validade.toISOString())}
                </span>
              </div>
            </div>

            {/* Ações */}
            <div className="flex flex-wrap gap-2">
              <BotaoGerarPdf cotacao={cotacao} />
              
              {/* Botões de envio só aparecem se tem lead vinculado */}
              {cotacao.lead_id ? (
                <>
                  {/* Se já foi enviada, mostra Reenviar. Senão, mostra Email */}
                  {cotacao.status !== 'rascunho' ? (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => reenviarCotacao(cotacao.id)}
                      disabled={isReenviando}
                    >
                      <Send className="mr-2 h-4 w-4" />
                      {isReenviando ? 'Reenviando...' : 'Reenviar'}
                    </Button>
                  ) : (
                    <Button variant="outline" size="sm" onClick={() => setShowEmailModal(true)}>
                      <Mail className="mr-2 h-4 w-4" />
                      Email
                    </Button>
                  )}
                  <Button variant="outline" size="sm" onClick={handleWhatsApp}>
                    <MessageSquare className="mr-2 h-4 w-4" />
                    WhatsApp
                  </Button>
                </>
              ) : (
                /* Aviso sutil quando não tem lead */
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-muted text-muted-foreground text-sm">
                  <AlertCircle className="h-4 w-4" />
                  Vincule a um lead para enviar
                </div>
              )}
              
              {/* Botão Aceitar e Gerar Contrato - para status enviada */}
              {(cotacao.status === 'enviada' || cotacao.status === 'rascunho') && cotacao.lead_id && (
                <Button
                  size="sm"
                  onClick={() => aceitarEGerar.mutate({ 
                    cotacaoId: cotacao.id, 
                    vendedorId: profile?.id 
                  })}
                  disabled={aceitarEGerar.isPending}
                  className="bg-emerald-600 hover:bg-emerald-700"
                >
                  {aceitarEGerar.isPending ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Check className="mr-2 h-4 w-4" />
                  )}
                  {aceitarEGerar.isPending ? 'Processando...' : 'Aceitar e Gerar Contrato'}
                </Button>
              )}
              
              {cotacao.status === 'aceita' && (
                <Button
                  size="sm"
                  onClick={() => gerarContrato.mutate({ 
                    cotacaoId: cotacao.id, 
                    vendedorId: profile?.id 
                  })}
                  disabled={gerarContrato.isPending}
                >
                  {gerarContrato.isPending ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <FileSignature className="mr-2 h-4 w-4" />
                  )}
                  {gerarContrato.isPending ? 'Gerando...' : 'Gerar Contrato'}
                </Button>
              )}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" disabled={isAtualizando}>
                    Status
                    <ChevronDown className="ml-2 h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => handleMudarStatus('enviada')}>
                    Enviada
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleMudarStatus('aceita')}>
                    Aceita
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleMudarStatus('recusada')}>
                    Recusada
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleMudarStatus('expirada')}>
                    Expirada
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* GRID DE CARDS */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* CARD: LEAD */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-base">
                <User className="h-4 w-4" />
                Lead
              </CardTitle>
              {/* Botão Trocar/Vincular */}
              {cotacao.lead_id ? (
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={() => setShowVincularModal(true)}
                >
                  <RefreshCw className="h-3 w-3 mr-1" />
                  Trocar
                </Button>
              ) : (
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => setShowVincularModal(true)}
                >
                  <Link2 className="h-3 w-3 mr-1" />
                  Vincular Lead
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {cotacao.lead_id ? (
              /* Conteúdo quando tem lead - nome já aparece no título */
              <>
                <div className="flex items-center gap-2 text-sm">
                  <Phone className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-xs text-muted-foreground">Telefone</p>
                    <p>{formatPhone(cotacao.leads?.telefone)}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-xs text-muted-foreground">Email</p>
                    <p>{cotacao.leads?.email || '—'}</p>
                  </div>
                </div>
                {cotacao.leads?.id && (
                  <Button variant="link" size="sm" className="p-0" asChild>
                    <Link to={`/vendas/leads/${cotacao.leads.id}`}>
                      Ver Lead
                      <ExternalLink className="ml-1 h-3 w-3" />
                    </Link>
                  </Button>
                )}
              </>
            ) : (
              /* Aviso quando não tem lead */
              <div className="text-center py-4 text-muted-foreground">
                <User className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm font-medium">Cotação avulsa</p>
                <p className="text-xs">Vincule a um lead para enviar</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* CARD: VEÍCULO */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Car className="h-4 w-4" />
              Veículo
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-lg font-medium">
              {cotacao.veiculo_marca} {cotacao.veiculo_modelo}
            </p>
            <Separator />
            <div className="grid grid-cols-3 gap-4 text-sm">
              <div>
                <p className="text-xs text-muted-foreground">Ano</p>
                <p>{cotacao.veiculo_ano || '—'}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Placa</p>
                <p>{cotacao.leads?.veiculo_placa || '—'}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Valor FIPE</p>
                <p className="font-medium">{formatCurrency(cotacao.valor_fipe)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* CARD: PLANO */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Plano Selecionado
          </CardTitle>
          <CardDescription>
            Detalhes da proteção cotada
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Nome do plano */}
          <div>
            <h3 className="text-xl font-semibold">
              {cotacao.planos?.nome || 'Plano'}
            </h3>
            <p className="text-muted-foreground">
              {cotacao.planos?.descricao || '100% FIPE + Coberturas completas'}
            </p>
          </div>

          {/* Coberturas */}
          <div>
            <p className="mb-2 text-sm font-medium">Coberturas incluídas:</p>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {coberturas.map((cobertura, index) => (
                <div key={index} className="flex items-center gap-2 text-sm">
                  <Check className="h-4 w-4 text-green-600" />
                  {cobertura}
                </div>
              ))}
            </div>
          </div>

          <Separator />

          {/* Valores */}
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="rounded-lg border bg-muted/50 p-4 text-center">
              <p className="text-sm text-muted-foreground">Adesão</p>
              <p className="text-2xl font-bold text-primary">
                {formatCurrency(cotacao.valor_adesao)}
              </p>
            </div>
            <div className="rounded-lg border bg-muted/50 p-4 text-center">
              <p className="text-sm text-muted-foreground">Mensalidade</p>
              <p className="text-2xl font-bold text-primary">
                {formatCurrency(cotacao.valor_total_mensal)}
              </p>
            </div>
            <div className="rounded-lg border bg-primary/10 p-4 text-center">
              <p className="text-sm text-muted-foreground">1º Pagamento</p>
              <p className="text-2xl font-bold text-primary">
                {formatCurrency(primeiroPagamento)}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* CARD: VENDEDOR */}
      {cotacao.vendedor && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <User className="h-4 w-4" />
              Vendedor Responsável
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-3">
              <Avatar>
                <AvatarFallback>
                  {cotacao.vendedor.nome?.charAt(0).toUpperCase() || 'V'}
                </AvatarFallback>
              </Avatar>
              <div>
                <p className="font-medium">{cotacao.vendedor.nome}</p>
                <p className="text-sm text-muted-foreground">{cotacao.vendedor.email}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Modal de Email */}
      {cotacao && (
        <EnviarEmailModal
          open={showEmailModal}
          onOpenChange={setShowEmailModal}
          cotacao={cotacao}
        />
      )}

      {/* Modal Vincular Lead */}
      <VincularLeadModal
        open={showVincularModal}
        onOpenChange={setShowVincularModal}
        cotacaoId={cotacao.id}
        leadAtualId={cotacao.lead_id}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ['cotacoes', id] });
        }}
      />
    </div>
  );
}
