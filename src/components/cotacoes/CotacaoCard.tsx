import { useNavigate } from 'react-router-dom';
import { FileText, Send, Check, X, MessageCircle, FileDown, Mail, FileSignature, Eye, Link2, Copy, Trash2, MoreHorizontal, Car, User, Phone, RefreshCw, ClipboardCopy, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
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
  | 'cotacao_realizada'
  | 'escolhendo_plano'
  | 'enviando_documentos'
  | 'escolha_vistoria'
  | 'realizando_pagamento'
  | 'assinando_contrato'
  | 'vistoria_agendada'
  | 'instalacao_agendada'
  | 'realizando_vistoria'
  | 'vistoria_realizada'
  | 'associado_ativo';

const etapaVendaConfig: Record<EtapaVenda, { label: string; color: string; bgColor: string }> = {
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
  associado_ativo: {
    label: 'Associado Ativo',
    color: 'text-emerald-600 dark:text-emerald-400',
    bgColor: 'bg-emerald-500/20',
  },
};

// Função para determinar a etapa da venda
const getEtapaVenda = (cotacao: CotacaoWithRelations): EtapaVenda | null => {
  // Se é rascunho, não mostra etapa
  if (cotacao.status === 'rascunho') return null;
  
  // Verificar se associado está ativo
  const associadoStatus = cotacao.contrato?.associados?.status;
  if (associadoStatus === 'ativo') return 'associado_ativo';
  
  // Verificar status da instalação/vistoria
  const instalacao = cotacao.instalacoes?.[0];
  if (instalacao) {
    if (instalacao.status === 'concluida') return 'vistoria_realizada';
    if (instalacao.status === 'em_andamento' || instalacao.status === 'em_rota') return 'realizando_vistoria';
    if (instalacao.status === 'agendada' || instalacao.status === 'reagendada') {
      // Diferenciar entre vistoria agendada e instalação agendada
      const tipoVistoria = cotacao.tipo_vistoria;
      if (tipoVistoria === 'autovistoria') return 'instalacao_agendada';
      return 'vistoria_agendada';
    }
  }
  
  // Verificar status_contratacao
  const statusContratacao = cotacao.status_contratacao;
  
  if (statusContratacao === 'contrato_assinado' || statusContratacao === 'contrato_gerado') {
    // Se contrato assinado mas sem instalação agendada
    return 'vistoria_agendada';
  }
  if (statusContratacao === 'pagamento_ok') return 'assinando_contrato';
  if (statusContratacao === 'vistoria_ok') return 'realizando_pagamento';
  if (statusContratacao === 'documentos_ok') return 'escolha_vistoria';
  if (statusContratacao === 'dados_preenchidos') return 'enviando_documentos';
  if (statusContratacao === 'plano_escolhido') return 'escolhendo_plano';
  
  // Default para cotações enviadas/aceitas sem status_contratacao específico
  return 'cotacao_realizada';
};

export interface CotacaoCardPermissions {
  canEdit: boolean;
  canDelete: boolean;
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
                <span className="text-muted-foreground text-sm">Mensal: </span>
                <span className="font-semibold text-primary text-base">
                  {formatCurrency(cotacao.valor_total_mensal)}
                </span>
              </div>
            );
          })()}
        </div>
        
        <Separator className="my-3" />
        
        {/* Ações */}
        <div className="flex flex-wrap gap-2" onClick={(e) => e.stopPropagation()}>
          <Button 
            size="sm" 
            variant="outline"
            onClick={() => navigate(`/vendas/cotacoes/${cotacao.id}`)}
          >
            <FileText className="h-4 w-4 mr-1" />
            Ver Detalhes
          </Button>
          
          {/* Ações por Status - com controle de permissão */}
          {cotacao.status === 'rascunho' && hasLead && permissions?.canSend !== false && (
            <>
              <Button size="sm" variant="outline" onClick={() => onWhatsApp(cotacao)}>
                <MessageCircle className="h-4 w-4 mr-1 text-green-600" />
                WhatsApp
              </Button>
              <Button size="sm" variant="outline" onClick={() => onEmail(cotacao)}>
                <Mail className="h-4 w-4 mr-1 text-blue-600" />
                Email
              </Button>
            </>
          )}
          
          {cotacao.status === 'rascunho' && !hasLead && onCopiarWhatsApp && permissions?.canSend !== false && (
            <Button
              size="sm"
              className="bg-green-600 hover:bg-green-700 text-white"
              onClick={() => onCopiarWhatsApp(cotacao)}
            >
              <ClipboardCopy className="h-4 w-4 mr-1" />
              Copiar para WhatsApp
            </Button>
          )}
          
          {/* Só mostra botão Gerar Proposta se:
              - Cotação é rascunho sem lead
              - Não existe contrato vinculado
              - Não existe contrato_gerado_id
              - Não está em status de contratação avançado (cliente já está no fluxo público)
          */}
          {cotacao.status === 'rascunho' && !hasLead && onGerarContrato && permissions?.canGenerateContract !== false && !cotacao.contrato && !cotacao.contrato_gerado_id && !['dados_preenchidos', 'documentos_ok', 'vistoria_ok', 'pagamento_ok', 'contrato_gerado'].includes(cotacao.status_contratacao || '') && (
            <Button 
              size="sm"
              variant="outline"
              onClick={() => onGerarContrato(cotacao.id)}
              disabled={isGerandoContrato}
            >
              <FileSignature className="h-4 w-4 mr-1" />
              {isGerandoContrato ? 'Gerando...' : 'Gerar Proposta'}
            </Button>
          )}
          
          {cotacao.status === 'enviada' && (
            <>
              {permissions?.canSend !== false && (
                <Button size="sm" variant="outline" onClick={() => onWhatsApp(cotacao)}>
                  <RefreshCw className="h-4 w-4 mr-1" />
                  Reenviar
                </Button>
              )}
              {permissions?.canEdit !== false && (
                <Button size="sm" onClick={() => onAceitar(cotacao.id)}>
                  <Check className="h-4 w-4 mr-1" />
                  Aceitar
                </Button>
              )}
            </>
          )}
          
          {/* Só mostra botão Gerar Proposta para cotação aceita se não existe contrato nem contrato_gerado_id */}
          {cotacao.status === 'aceita' && onGerarContrato && !cotacao.contrato && !cotacao.contrato_gerado_id && permissions?.canGenerateContract !== false && (
            <Button 
              size="sm"
              onClick={() => onGerarContrato(cotacao.id)}
              disabled={isGerandoContrato}
            >
              <FileSignature className="h-4 w-4 mr-1" />
              {isGerandoContrato ? 'Gerando...' : 'Gerar Proposta'}
            </Button>
          )}
          
          {cotacao.status === 'aceita' && cotacao.contrato && (
            <Button 
              size="sm"
              variant="outline"
              onClick={() => navigate('/vendas/contratos', { 
                state: { openContrato: cotacao.contrato!.id } 
              })}
            >
              <FileSignature className="h-4 w-4 mr-1" />
              Ver Contrato
            </Button>
          )}
          
          {/* Menu de ações extras */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" variant="ghost" className="px-2">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => onPdf(cotacao)}>
                <FileDown className="h-4 w-4 mr-2" />
                Baixar PDF
              </DropdownMenuItem>
              {cotacao.token_publico && (
                <>
                  <DropdownMenuItem onClick={() => {
                    const link = `${window.location.origin}/cotacao/${cotacao.token_publico}`;
                    window.open(link, '_blank');
                  }}>
                    <ExternalLink className="h-4 w-4 mr-2" />
                    Acessar Link do Cliente
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => {
                    const link = `${window.location.origin}/cotacao/${cotacao.token_publico}`;
                    navigator.clipboard.writeText(link);
                  }}>
                    <Link2 className="h-4 w-4 mr-2" />
                    Copiar Link
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