import { useState } from 'react';
import { format, formatDistanceToNow, isToday, isYesterday } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { FileText, Send, Check, X, Eye, Car, Phone, User, MoreHorizontal, ClipboardCopy, ExternalLink, Link2, FileDown, Loader2, Plus, ArrowRight } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { UserAvatar } from '@/components/UserAvatar';
import type { CotacaoWithRelations } from '@/hooks/useCotacoes';
import type { StatusCotacao } from '@/types/database';
import { toast } from 'sonner';

type StatusCotacaoExtended = StatusCotacao | 'visualizada';

// Etapas da venda
type EtapaVenda = 
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
  | 'veiculo_recusado'
  | 'cancelado';

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
    bgColor: 'bg-yellow-500/15',
    borderColor: 'border-l-yellow-500',
    icon: FileText 
  },
  enviada: { 
    label: 'Enviada', 
    color: 'text-blue-600 dark:text-blue-400', 
    bgColor: 'bg-blue-500/15',
    borderColor: 'border-l-blue-500',
    icon: Send 
  },
  visualizada: { 
    label: 'Visualizada', 
    color: 'text-cyan-600 dark:text-cyan-400', 
    bgColor: 'bg-cyan-500/15',
    borderColor: 'border-l-cyan-500',
    icon: Eye 
  },
  aceita: { 
    label: 'Aceita', 
    color: 'text-green-600 dark:text-green-400', 
    bgColor: 'bg-green-500/15',
    borderColor: 'border-l-green-500',
    icon: Check 
  },
  recusada: { 
    label: 'Recusada', 
    color: 'text-red-600 dark:text-red-400', 
    bgColor: 'bg-red-500/15',
    borderColor: 'border-l-red-500',
    icon: X 
  },
  expirada: { 
    label: 'Expirada', 
    color: 'text-muted-foreground', 
    bgColor: 'bg-muted',
    borderColor: 'border-l-muted-foreground/50',
    icon: FileText 
  },
};

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
  veiculo_recusado: {
    label: 'Veículo Recusado',
    color: 'text-red-600 dark:text-red-400',
    bgColor: 'bg-red-500/20',
  },
  cancelado: {
    label: 'Cancelado',
    color: 'text-red-600 dark:text-red-400',
    bgColor: 'bg-red-500/20',
  },
};

// Função para determinar a etapa da venda - CORRIGIDA para verificar pagamento antes de vistoria
export const getEtapaVenda = (cotacao: CotacaoWithRelations): EtapaVenda | null => {
  // PRIORIDADE MÁXIMA: Cancelamento
  const associadoStatus = cotacao.contrato?.associados?.status;
  const contratoStatus = cotacao.contrato?.status;
  if (associadoStatus === 'cancelado' || contratoStatus === 'cancelado' || cotacao.status_contratacao === 'cancelado') {
    return 'cancelado';
  }

  // PRIORIDADE ALTA: Se veículo foi recusado, mostrar imediatamente
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

export interface CotacoesTablePermissions {
  canEdit: boolean;
  canDelete: boolean;
  canSend: boolean;
  canDuplicate: boolean;
  canGenerateContract: boolean;
}

interface CotacoesTableProps {
  cotacoes: CotacaoWithRelations[];
  onRowClick: (cotacao: CotacaoWithRelations) => void;
  onCopiarWhatsApp: (cotacao: CotacaoWithRelations) => void;
  onPdf: (cotacao: CotacaoWithRelations) => void;
  onDuplicar: (cotacao: CotacaoWithRelations) => void;
  onExcluir: (id: string) => void;
  copiandoWhatsAppId: string | null;
  getPermissions: (cotacao: CotacaoWithRelations) => CotacoesTablePermissions;
  selectable?: boolean;
  selectedIds?: Set<string>;
  onToggleSelect?: (id: string) => void;
  onToggleAll?: () => void;
}

// Avatar gradient colors based on initial
const avatarGradients = [
  'from-blue-500 to-cyan-400',
  'from-purple-500 to-pink-400',
  'from-amber-500 to-orange-400',
  'from-emerald-500 to-teal-400',
  'from-rose-500 to-red-400',
  'from-indigo-500 to-violet-400',
  'from-lime-500 to-green-400',
  'from-fuchsia-500 to-purple-400',
];

function getAvatarGradient(name: string) {
  const charCode = (name || 'A').charCodeAt(0);
  return avatarGradients[charCode % avatarGradients.length];
}

function formatSmartDate(dateStr: string) {
  const date = new Date(dateStr);
  if (isToday(date)) return 'Hoje';
  if (isYesterday(date)) return 'Ontem';
  return format(date, 'dd/MM');
}

export function CotacoesTable({
  cotacoes,
  onRowClick,
  onCopiarWhatsApp,
  onPdf,
  onDuplicar,
  onExcluir,
  copiandoWhatsAppId,
  getPermissions,
  selectable = false,
  selectedIds,
  onToggleSelect,
  onToggleAll,
}: CotacoesTableProps) {
  const formatPhone = (phone?: string | null) => {
    if (!phone) return null;
    const cleaned = phone.replace(/\D/g, '');
    if (cleaned.length === 11) {
      return `(${cleaned.slice(0,2)}) ${cleaned.slice(2,7)}-${cleaned.slice(7)}`;
    }
    if (cleaned.length === 10) {
      return `(${cleaned.slice(0,2)}) ${cleaned.slice(2,6)}-${cleaned.slice(6)}`;
    }
    return phone;
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  if (cotacoes.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="h-20 w-20 rounded-full bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center mb-5">
          <FileText className="h-10 w-10 text-primary/60" />
        </div>
        <p className="text-foreground font-semibold text-lg">Nenhuma cotação encontrada</p>
        <p className="text-sm text-muted-foreground mt-1 max-w-xs">
          Ajuste os filtros ou comece criando uma nova cotação para seu cliente
        </p>
      </div>
    );
  }

  return (
    <TooltipProvider delayDuration={300}>
      <div className="rounded-xl border bg-card overflow-hidden shadow-sm">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/40 hover:bg-muted/40 border-b-2 border-border/60">
              {selectable && (
                <TableHead className="w-[40px]">
                  <Checkbox
                    checked={cotacoes.length > 0 && selectedIds?.size === cotacoes.length}
                    onCheckedChange={() => onToggleAll?.()}
                    aria-label="Selecionar todas"
                  />
                </TableHead>
              )}
              <TableHead className="w-[180px] font-semibold text-[11px] uppercase tracking-wider text-muted-foreground/80">Status</TableHead>
              <TableHead className="font-semibold text-[11px] uppercase tracking-wider text-muted-foreground/80">Cliente</TableHead>
              <TableHead className="hidden md:table-cell font-semibold text-[11px] uppercase tracking-wider text-muted-foreground/80">Veículo</TableHead>
              <TableHead className="hidden lg:table-cell font-semibold text-[11px] uppercase tracking-wider text-muted-foreground/80">FIPE</TableHead>
              <TableHead className="hidden lg:table-cell font-semibold text-[11px] uppercase tracking-wider text-muted-foreground/80">Consultor</TableHead>
              <TableHead className="hidden sm:table-cell font-semibold text-[11px] uppercase tracking-wider text-muted-foreground/80">Data</TableHead>
              <TableHead className="w-[110px] font-semibold text-[11px] uppercase tracking-wider text-muted-foreground/80">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {cotacoes.map((cotacao) => {
              const status = statusConfig[cotacao.status as StatusCotacaoExtended] || statusConfig.rascunho;
              const etapaVenda = getEtapaVenda(cotacao);
              const etapaInfo = etapaVenda ? etapaVendaConfig[etapaVenda] : null;
              const permissions = getPermissions(cotacao);
              const isCopiando = copiandoWhatsAppId === cotacao.id;
              const clienteName = cotacao.leads?.nome || cotacao.nome_solicitante || 'Sem nome';
              const avatarGradient = getAvatarGradient(clienteName);
              
              return (
                <TableRow 
                  key={cotacao.id}
                  className={cn(
                    "cursor-pointer border-l-4 transition-all duration-200",
                    status.borderColor,
                    "hover:bg-primary/[0.06] hover:shadow-sm hover:translate-x-[2px]",
                    selectable && selectedIds?.has(cotacao.id) && "bg-primary/[0.08]",
                  )}
                  onClick={() => onRowClick(cotacao)}
                >
                  {selectable && (
                    <TableCell onClick={(e) => e.stopPropagation()} className="py-3">
                      <Checkbox
                        checked={selectedIds?.has(cotacao.id) ?? false}
                        onCheckedChange={() => onToggleSelect?.(cotacao.id)}
                        aria-label={`Selecionar cotação ${cotacao.numero}`}
                      />
                    </TableCell>
                  )}
                  {/* Status / Etapa */}
                  <TableCell className="py-3">
                    <div className="flex flex-col gap-1.5">
                      <Badge className={cn(
                        status.bgColor, status.color, 
                        "font-semibold border-0 text-[11px] px-2.5 py-0.5 w-fit rounded-full"
                      )}>
                        <status.icon className="h-3 w-3 mr-1" />
                        {status.label}
                      </Badge>
                      {etapaInfo && (
                        <div className={cn(
                          "flex items-center gap-1 text-[10px] font-medium w-fit px-2 py-0.5 rounded-full",
                          etapaInfo.bgColor, etapaInfo.color
                        )}>
                          <ArrowRight className="h-2.5 w-2.5" />
                          {etapaInfo.label}
                        </div>
                      )}
                    </div>
                  </TableCell>
                  
                  {/* Cliente */}
                  <TableCell className="py-3">
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        "flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[11px] font-bold text-white bg-gradient-to-br",
                        avatarGradient
                      )}>
                        {clienteName.charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <p className="font-semibold truncate text-sm leading-tight">
                          {clienteName}
                        </p>
                        {cotacao.leads?.telefone && (
                          <a
                            href={`tel:${cotacao.leads.telefone}`}
                            className="text-[11px] text-muted-foreground hover:text-primary flex items-center gap-1 mt-0.5 transition-colors"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <Phone className="h-2.5 w-2.5" />
                            {formatPhone(cotacao.leads.telefone)}
                          </a>
                        )}
                      </div>
                    </div>
                  </TableCell>
                  
                  {/* Veículo */}
                  <TableCell className="hidden md:table-cell py-3">
                    <div className="min-w-0">
                      <p className="text-sm truncate leading-tight">
                        {cotacao.veiculo_marca} {cotacao.veiculo_modelo}
                      </p>
                      <div className="flex items-center gap-1.5 mt-1">
                        <span className="text-[11px] text-muted-foreground">{cotacao.veiculo_ano}</span>
                        {cotacao.veiculo_placa && (
                          <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground font-semibold tracking-wider">
                            {cotacao.veiculo_placa}
                          </span>
                        )}
                      </div>
                    </div>
                  </TableCell>
                  
                  {/* Valor FIPE */}
                  <TableCell className="hidden lg:table-cell py-3">
                    <span className="font-semibold text-sm text-primary">{formatCurrency(cotacao.valor_fipe)}</span>
                  </TableCell>
                  
                  {/* Consultor */}
                  <TableCell className="hidden lg:table-cell py-3">
                    {cotacao.vendedor?.nome && (
                      <div className="flex items-center gap-1.5">
                        <UserAvatar name={cotacao.vendedor.nome} size="sm" className="h-5 w-5 text-[9px]" />
                        <span className="text-xs truncate max-w-[80px] text-muted-foreground">{cotacao.vendedor.nome}</span>
                      </div>
                    )}
                  </TableCell>
                  
                  {/* Data */}
                  <TableCell className="hidden sm:table-cell py-3">
                    <div>
                      <p className="text-sm font-medium">{formatSmartDate(cotacao.created_at)}</p>
                      <p className="text-[10px] text-muted-foreground">
                        {format(new Date(cotacao.created_at), 'HH:mm')}
                      </p>
                    </div>
                  </TableCell>
                  
                  {/* Ações */}
                  <TableCell onClick={(e) => e.stopPropagation()} className="py-3">
                    <div className="flex items-center gap-1">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8 text-green-600 hover:text-green-700 hover:bg-green-500/10"
                            onClick={() => onCopiarWhatsApp(cotacao)}
                            disabled={isCopiando || permissions.canSend === false}
                          >
                            {isCopiando ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <ClipboardCopy className="h-4 w-4" />
                            )}
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Copiar para WhatsApp</TooltipContent>
                      </Tooltip>
                      
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8 hover:bg-muted"
                            onClick={() => onPdf(cotacao)}
                          >
                            <FileDown className="h-4 w-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Baixar PDF</TooltipContent>
                      </Tooltip>
                      
                      {/* Menu de ações extras */}
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button size="icon" variant="ghost" className="h-8 w-8 hover:bg-muted">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => onRowClick(cotacao)}>
                            <Eye className="h-4 w-4 mr-2" />
                            Ver Detalhes
                          </DropdownMenuItem>
                          
                          {cotacao.token_publico && (
                            <>
                              <DropdownMenuItem onClick={() => {
                                const link = `${window.location.origin}/cotacao/${cotacao.token_publico}`;
                                window.open(link, '_blank');
                              }}>
                                <ExternalLink className="h-4 w-4 mr-2" />
                                Acessar Link
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => {
                                const link = `${window.location.origin}/cotacao/${cotacao.token_publico}`;
                                navigator.clipboard.writeText(link);
                                toast.success('Link copiado!');
                              }}>
                                <Link2 className="h-4 w-4 mr-2" />
                                Copiar Link
                              </DropdownMenuItem>
                            </>
                          )}
                          
                          {permissions.canDuplicate && (
                            <>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem onClick={() => onDuplicar(cotacao)}>
                                <FileText className="h-4 w-4 mr-2" />
                                Duplicar
                              </DropdownMenuItem>
                            </>
                          )}
                          
                          {permissions.canDelete && cotacao.status === 'rascunho' && (
                            <>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem 
                                onClick={() => onExcluir(cotacao.id)}
                                className="text-destructive focus:text-destructive"
                              >
                                <X className="h-4 w-4 mr-2" />
                                Excluir
                              </DropdownMenuItem>
                            </>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </TooltipProvider>
  );
}
