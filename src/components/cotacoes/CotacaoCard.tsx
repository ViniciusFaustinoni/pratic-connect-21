import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { FileText, Send, Check, X, MessageCircle, FileDown, Mail, FileSignature, Eye, Link2, Copy, Trash2, MoreHorizontal, Car, User, Phone, RefreshCw, ClipboardCopy, ExternalLink, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { StatusCotacao } from '@/types/database';
import type { CotacaoWithRelations } from '@/hooks/useCotacoes';
import { cn } from '@/lib/utils';
import { UserAvatar } from '@/components/UserAvatar';

type StatusCotacaoExtended = StatusCotacao | 'visualizada';

const statusConfig: Record<StatusCotacaoExtended, { 
  label: string; 
  color: string;
  bgColor: string;
  borderColor: string;
  icon: typeof FileText 
}> = {
  rascunho: { 
    label: 'Rascunho', 
    color: 'text-yellow-600 dark:text-yellow-400', 
    bgColor: 'bg-yellow-500/20',
    borderColor: 'border-l-yellow-500',
    icon: FileText 
  },
  enviada: { 
    label: 'Enviada', 
    color: 'text-blue-600 dark:text-blue-400', 
    bgColor: 'bg-blue-500/20',
    borderColor: 'border-l-blue-500',
    icon: Send 
  },
  visualizada: { 
    label: 'Visualizada', 
    color: 'text-cyan-600 dark:text-cyan-400', 
    bgColor: 'bg-cyan-500/20',
    borderColor: 'border-l-cyan-500',
    icon: Eye 
  },
  aceita: { 
    label: 'Aceita', 
    color: 'text-green-600 dark:text-green-400', 
    bgColor: 'bg-green-500/20',
    borderColor: 'border-l-green-500',
    icon: Check 
  },
  recusada: { 
    label: 'Recusada', 
    color: 'text-red-600 dark:text-red-400', 
    bgColor: 'bg-red-500/20',
    borderColor: 'border-l-red-500',
    icon: X 
  },
  expirada: { 
    label: 'Expirada', 
    color: 'text-muted-foreground', 
    bgColor: 'bg-muted',
    borderColor: 'border-l-muted-foreground',
    icon: FileText 
  },
};

// Etapas da venda
type EtapaVenda = 
  | 'veiculo_recusado'
  | 'cotacao_realizada'
  | 'escolhendo_plano'
  | 'enviando_documentos'
  | 'escolha_vistoria'
  | 'realizando_autovistoria'
  | 'realizando_pagamento'
  | 'assinando_contrato'
  | 'vistoria_agendada'
  | 'instalacao_agendada'
  | 'realizando_vistoria'
  | 'vistoria_realizada'
  | 'em_analise'
  | 'associado_ativo'
  | 'cancelado';

const etapaVendaConfig: Record<EtapaVenda, { label: string; color: string; bgColor: string }> = {
  veiculo_recusado: {
    label: 'Veículo Recusado',
    color: 'text-red-600 dark:text-red-400',
    bgColor: 'bg-red-500/20',
  },
  cotacao_realizada: {
    label: 'Cotação Realizada',
    color: 'text-slate-600 dark:text-slate-400',
    bgColor: 'bg-slate-500/20',
  },
  escolhendo_plano: {
    label: 'Escolhendo Plano',
    color: 'text-sky-600 dark:text-sky-400',
    bgColor: 'bg-sky-500/20',
  },
  enviando_documentos: {
    label: 'Enviando Documentos',
    color: 'text-blue-600 dark:text-blue-400',
    bgColor: 'bg-blue-500/20',
  },
  escolha_vistoria: {
    label: 'Escolha de Vistoria',
    color: 'text-indigo-600 dark:text-indigo-400',
    bgColor: 'bg-indigo-500/20',
  },
  realizando_autovistoria: {
    label: 'Realizando Autovistoria',
    color: 'text-purple-600 dark:text-purple-400',
    bgColor: 'bg-purple-500/20',
  },
  realizando_pagamento: {
    label: 'Realizando Pagamento',
    color: 'text-amber-600 dark:text-amber-400',
    bgColor: 'bg-amber-500/20',
  },
  assinando_contrato: {
    label: 'Assinando Contrato',
    color: 'text-orange-600 dark:text-orange-400',
    bgColor: 'bg-orange-500/20',
  },
  vistoria_agendada: {
    label: 'Vistoria Agendada',
    color: 'text-violet-600 dark:text-violet-400',
    bgColor: 'bg-violet-500/20',
  },
  instalacao_agendada: {
    label: 'Instalação Agendada',
    color: 'text-purple-600 dark:text-purple-400',
    bgColor: 'bg-purple-500/20',
  },
  realizando_vistoria: {
    label: 'Realizando Vistoria',
    color: 'text-cyan-600 dark:text-cyan-400',
    bgColor: 'bg-cyan-500/20',
  },
  vistoria_realizada: {
    label: 'Vistoria Realizada',
    color: 'text-teal-600 dark:text-teal-400',
    bgColor: 'bg-teal-500/20',
  },
  em_analise: {
    label: 'Em Análise',
    color: 'text-yellow-600 dark:text-yellow-400',
    bgColor: 'bg-yellow-500/20',
  },
  associado_ativo: {
    label: 'Associado Ativo',
    color: 'text-emerald-600 dark:text-emerald-400',
    bgColor: 'bg-emerald-500/20',
  },
  cancelado: {
    label: 'Cancelado',
    color: 'text-red-600 dark:text-red-400',
    bgColor: 'bg-red-500/20',
  },
};

// Função para determinar a etapa da venda - CORRIGIDA para verificar pagamento antes de vistoria
const getEtapaVenda = (cotacao: CotacaoWithRelations): EtapaVenda | null => {
  // PRIORIDADE MÁXIMA: Cancelamento
  const associadoStatus = cotacao.contrato?.associados?.status;
  const contratoStatus = cotacao.contrato?.status;
  if (associadoStatus === 'cancelado' || contratoStatus === 'cancelado' || cotacao.status_contratacao === 'cancelado') {
    return 'cancelado';
  }

  // PRIORIDADE ALTA: Se veículo foi recusado
  if (cotacao.status === 'recusada' || cotacao.status_contratacao === 'veiculo_recusado') {
    return 'veiculo_recusado';
  }
  
  const statusContratacao = cotacao.status_contratacao;
  const temContratacaoAtiva = statusContratacao && 
    statusContratacao !== 'aguardando' && 
    statusContratacao !== null;
  
  if (cotacao.status === 'rascunho' && !temContratacaoAtiva && !cotacao.contrato) return null;
  
  // PRIORIDADE 1: Status do associado APENAS para etapas finais (pós-vistoria)
  if (associadoStatus === 'ativo') return 'associado_ativo';
  if (associadoStatus === 'em_analise') return 'em_analise';
  
  // PRIORIDADE 2: Verificar vistoria em andamento/concluída
  const instalacao = cotacao.instalacoes?.[0];
  if (instalacao) {
    if (instalacao.status === 'concluida') return 'vistoria_realizada';
    if (instalacao.status === 'em_andamento' || instalacao.status === 'em_rota') return 'realizando_vistoria';
  }
  
  // PRIORIDADE 3: Verificar se pagamento foi feito ANTES de considerar vistoria agendada
  const adesaoPaga = cotacao.contrato?.adesao_paga;
  
  // Se autovistoria foi escolhida mas pagamento ainda não feito, está na etapa de autovistoria
  if (cotacao.tipo_vistoria === 'autovistoria' && adesaoPaga === false) {
    return 'realizando_autovistoria';
  }

  // Se contrato existe e foi assinado, verificar pagamento primeiro
  if (contratoStatus === 'assinado' || contratoStatus === 'ativo') {
    if (adesaoPaga === false) {
      return 'realizando_pagamento';
    }
  }
  
  // Agora sim verificar vistoria agendada (somente se pagamento OK)
  if (instalacao && (instalacao.status === 'agendada' || instalacao.status === 'reagendada')) {
    const tipoVistoria = cotacao.tipo_vistoria;
    if (tipoVistoria === 'autovistoria') return 'instalacao_agendada';
    return 'vistoria_agendada';
  }
  
  // Se associado pendente_vistoria E pagamento OK, mostrar vistoria agendada
  if (associadoStatus === 'pendente_vistoria' && adesaoPaga !== false) {
    return 'vistoria_agendada';
  }
  
  // PRIORIDADE 4: Verificar status_contratacao
  if (statusContratacao === 'pagamento_ok') return 'vistoria_agendada';
  
  if (statusContratacao === 'vistoria_ok') {
    const tipoVistoria = cotacao.tipo_vistoria;
    if (tipoVistoria === 'agendada' && cotacao.vistoria_data_agendada) {
      return 'vistoria_agendada';
    }
    return 'realizando_pagamento';
  }
  
  if (statusContratacao === 'contrato_assinado' || statusContratacao === 'contrato_gerado') {
    if (adesaoPaga === false) return 'realizando_pagamento';
    return 'vistoria_agendada';
  }
  if (statusContratacao === 'documentos_ok') return 'escolha_vistoria';
  if (statusContratacao === 'dados_preenchidos') return 'enviando_documentos';
  if (statusContratacao === 'plano_escolhido') return 'escolhendo_plano';
  
  // PRIORIDADE 5: Fallback - status do contrato
  if (contratoStatus === 'assinado' && adesaoPaga === false) {
    return 'realizando_pagamento';
  }
  
  if (contratoStatus === 'assinado' || contratoStatus === 'ativo') {
    return 'vistoria_agendada';
  }
  
  if (cotacao.status === 'enviada' || cotacao.status === 'aceita') {
    return 'cotacao_realizada';
  }
  
  if (temContratacaoAtiva) return 'cotacao_realizada';
  
  return null;
};

export interface CotacaoCardPermissions {
  canEdit: boolean;
  canDelete: boolean;
  deleteReason?: string;
  canSend: boolean;
  canDuplicate: boolean;
  canGenerateContract: boolean;
}

interface CotacaoCardProps {
  cotacao: CotacaoWithRelations;
  tipo: 'andamento' | 'fechada';
  navigate: ReturnType<typeof useNavigate>;
  formatRelativeTime: (dateStr: string) => string;
  formatPhone: (phone?: string | null) => string | null;
  formatCurrency: (value: number) => string;
  onVincular: (cotacao: CotacaoWithRelations) => void;
  onWhatsApp: (cotacao: CotacaoWithRelations) => void;
  onEmail: (cotacao: CotacaoWithRelations) => void;
  onAceitar: (cotacaoId: string) => void;
  onPdf: (cotacao: CotacaoWithRelations) => void;
  onDuplicar: (cotacao: CotacaoWithRelations) => void;
  onExcluir: (id: string) => void;
  onGerarContrato?: (id: string) => void;
  isGerandoContrato?: boolean;
  onCopiarWhatsApp?: (cotacao: CotacaoWithRelations) => void;
  permissions?: CotacaoCardPermissions;
  isCopiandoWhatsApp?: boolean;
}

export function CotacaoCard({
  cotacao,
  tipo,
  navigate,
  formatRelativeTime,
  formatPhone,
  formatCurrency,
  onVincular,
  onWhatsApp,
  onEmail,
  onAceitar,
  onPdf,
  onDuplicar,
  onExcluir,
  onGerarContrato,
  isGerandoContrato = false,
  onCopiarWhatsApp,
  permissions,
  isCopiandoWhatsApp = false,
}: CotacaoCardProps) {
  const status = statusConfig[cotacao.status as StatusCotacaoExtended] || statusConfig.rascunho;
  const hasLead = !!cotacao.lead_id;
  const vendedorNome = cotacao.vendedor?.nome;
  
  // Determinar etapa da venda
  const etapaVenda = getEtapaVenda(cotacao);
  const etapaInfo = etapaVenda ? etapaVendaConfig[etapaVenda] : null;
  
  // Cores de fundo baseadas no tipo
  const getBgClass = () => {
    if (tipo === 'andamento') return 'border-l-yellow-500 bg-yellow-500/5';
    if (cotacao.status === 'aceita') return 'border-l-green-500 bg-green-500/5';
    if (cotacao.status === 'recusada') return 'border-l-red-500 bg-red-500/5';
    return status.borderColor;
  };

  return (
    <Card 
      className={cn(
        "overflow-hidden border-l-4 transition-all hover:shadow-md cursor-pointer",
        getBgClass()
      )}
      onClick={() => navigate(`/vendas/cotacoes/${cotacao.id}`)}
    >
      {/* Header do Card: Status + Etapa da Venda + Vendedor + Tempo */}
      <div className="flex items-center justify-between px-4 py-2 bg-muted/30 gap-2 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap">
          {cotacao.status !== 'rascunho' && (
            <Badge className={cn(status.bgColor, status.color, "font-medium border-0")}>
              <status.icon className="h-3 w-3 mr-1" />
              {status.label.toUpperCase()}
            </Badge>
          )}
          {etapaInfo && (
            <Badge className={cn(etapaInfo.bgColor, etapaInfo.color, "font-medium border-0 text-[10px]")}>
              {etapaInfo.label.toUpperCase()}
            </Badge>
          )}
          {vendedorNome && (
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <UserAvatar name={vendedorNome} size="sm" />
              <span className="hidden sm:inline">{vendedorNome}</span>
            </div>
          )}
        </div>
        <span className="text-xs text-muted-foreground">
          {formatRelativeTime(cotacao.created_at)}
        </span>
      </div>
      
      <CardContent className="p-4">
        {/* Conteúdo Principal: Lead + Veículo */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
          {/* Coluna Lead */}
          <div className="flex items-start gap-3">
            <div className={cn(
              "flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-medium",
              "bg-primary/10 text-primary"
            )}>
              {cotacao.leads?.nome?.charAt(0).toUpperCase() || cotacao.nome_solicitante?.charAt(0).toUpperCase() || <User className="h-5 w-5" />}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-lg truncate">
                {cotacao.leads?.nome || cotacao.nome_solicitante || ''}
              </p>
              {hasLead && cotacao.leads?.telefone && (
                <p className="text-sm text-muted-foreground flex items-center gap-1">
                  <Phone className="h-3 w-3" />
                  {formatPhone(cotacao.leads.telefone)}
                </p>
              )}
            </div>
          </div>
          
          {/* Coluna Veículo */}
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
              <Car className="h-5 w-5" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium truncate">
                {cotacao.veiculo_marca} {cotacao.veiculo_modelo} {cotacao.veiculo_ano}
              </p>
              <div className="flex items-center gap-2 flex-wrap text-sm text-muted-foreground">
                {cotacao.veiculo_placa && (
                  <Badge variant="outline" className="font-mono text-xs">
                    {cotacao.veiculo_placa}
                  </Badge>
                )}
                {cotacao.leads?.nome && (
                  <span className="text-xs text-primary font-medium truncate max-w-[150px]">
                    {cotacao.leads.nome}
                  </span>
                )}
                {!cotacao.veiculo_placa && !cotacao.leads?.nome && (
                  <span>Placa não informada</span>
                )}
              </div>
            </div>
          </div>
        </div>
        
        {/* Valores e Planos */}
        <div className="mb-4">
          <div className="flex flex-wrap gap-4 sm:gap-8 text-sm mb-2">
            <div>
              <span className="text-muted-foreground">FIPE: </span>
              <span className="font-medium">{formatCurrency(cotacao.valor_fipe)}</span>
            </div>
          </div>
          
          {(() => {
            const planosComparacao = (cotacao.dados_extras as { planos_comparacao?: { id: string; nome: string; valorMensal: number }[] } | null)?.planos_comparacao;
            
            if (planosComparacao && planosComparacao.length > 1) {
              return (
                <div className={`grid gap-2 ${planosComparacao.length === 2 ? 'grid-cols-2' : 'grid-cols-2 lg:grid-cols-3'}`}>
                  {planosComparacao.map((plano) => (
                    <div key={plano.id} className="p-2 rounded-lg border bg-muted/30">
                      <p className="text-xs font-medium truncate">{plano.nome}</p>
                      <p className="text-primary font-bold">
                        {formatCurrency(plano.valorMensal)}
                        <span className="text-[10px] font-normal text-muted-foreground">/mês</span>
                      </p>
                    </div>
                  ))}
                </div>
              );
            }
            
            return (
              <div>
                <span className="text-muted-foreground text-sm">Médio mensal: </span>
                <span className="font-semibold text-primary text-base">
                  {formatCurrency(cotacao.valor_total_mensal)}
                </span>
              </div>
            );
          })()}
        </div>
        
        <Separator className="my-3" />
        
        {/* Ações Principais - Sempre Visíveis */}
        <div className="flex flex-wrap gap-2" onClick={(e) => e.stopPropagation()}>
          {/* Copiar para WhatsApp */}
          {onCopiarWhatsApp && permissions?.canSend !== false && (
            <Button
              size="sm"
              className="bg-green-600 hover:bg-green-700 text-white"
              onClick={() => onCopiarWhatsApp(cotacao)}
              disabled={isCopiandoWhatsApp}
            >
              {isCopiandoWhatsApp ? (
                <>
                  <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                  Gerando...
                </>
              ) : (
                <>
                  <ClipboardCopy className="h-4 w-4 mr-1" />
                  Copiar para WhatsApp
                </>
              )}
            </Button>
          )}
          
          {/* Acessar Link do Cliente */}
          {cotacao.token_publico && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                const link = `${window.location.origin}/cotacao/${cotacao.token_publico}`;
                window.open(link, '_blank');
              }}
            >
              <ExternalLink className="h-4 w-4 mr-1" />
              Acessar Link
            </Button>
          )}
          
          {/* Copiar Link do Cliente */}
          {cotacao.token_publico && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                const link = `${window.location.origin}/cotacao/${cotacao.token_publico}`;
                navigator.clipboard.writeText(link);
                toast.success('Link copiado!');
              }}
            >
              <Link2 className="h-4 w-4 mr-1" />
              Copiar Link
            </Button>
          )}
          
          {/* Baixar PDF */}
          <Button
            size="sm"
            variant="outline"
            onClick={() => onPdf(cotacao)}
          >
            <FileDown className="h-4 w-4 mr-1" />
            Baixar PDF
          </Button>
          
          {/* Menu de ações extras */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" variant="ghost" className="px-2">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => navigate(`/vendas/cotacoes/${cotacao.id}`)}>
                <FileText className="h-4 w-4 mr-2" />
                Ver Detalhes
              </DropdownMenuItem>
              
              {cotacao.status === 'rascunho' && hasLead && permissions?.canSend !== false && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => onWhatsApp(cotacao)}>
                    <MessageCircle className="h-4 w-4 mr-2 text-green-600" />
                    Enviar via WhatsApp
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => onEmail(cotacao)}>
                    <Mail className="h-4 w-4 mr-2 text-blue-600" />
                    Enviar via Email
                  </DropdownMenuItem>
                </>
              )}
              
              {cotacao.status === 'enviada' && (
                <>
                  <DropdownMenuSeparator />
                  {permissions?.canSend !== false && (
                    <DropdownMenuItem onClick={() => onWhatsApp(cotacao)}>
                      <RefreshCw className="h-4 w-4 mr-2" />
                      Reenviar
                    </DropdownMenuItem>
                  )}
                  {permissions?.canEdit !== false && (
                    <DropdownMenuItem onClick={() => onAceitar(cotacao.id)}>
                      <Check className="h-4 w-4 mr-2" />
                      Aceitar
                    </DropdownMenuItem>
                  )}
                </>
              )}
              
              {cotacao.status === 'aceita' && cotacao.contrato && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => navigate('/vendas/contratos', { 
                    state: { openContrato: cotacao.contrato!.id } 
                  })}>
                    <FileSignature className="h-4 w-4 mr-2" />
                    Verificar Proposta
                  </DropdownMenuItem>
                </>
              )}
              
              {permissions?.canDuplicate !== false && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => onDuplicar(cotacao)}>
                    <Copy className="h-4 w-4 mr-2" />
                    Duplicar
                  </DropdownMenuItem>
                </>
              )}
              {permissions?.canDelete !== false && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem 
                    className="text-destructive focus:text-destructive"
                    onClick={() => onExcluir(cotacao.id)}
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Excluir
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardContent>
    </Card>
  );
}