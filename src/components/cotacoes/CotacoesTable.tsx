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
import { TrocaTitularidadeBadge } from '@/components/cotacoes/TrocaTitularidadeBadge';
import type { CotacaoWithRelations } from '@/hooks/useCotacoes';
import type { StatusCotacao } from '@/types/database';
import { toast } from 'sonner';

export type StatusCotacaoExtended = StatusCotacao | 'visualizada';

// Re-exporta a fonte única para retrocompatibilidade de imports
import { getEtapaVenda, etapaVendaConfig, type EtapaVenda } from '@/lib/cotacaoEtapa';
export { getEtapaVenda, etapaVendaConfig, type EtapaVenda };

export const statusConfig: Record<StatusCotacaoExtended, { 
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

export interface CotacoesTablePermissions {
  canEdit: boolean;
  canDelete: boolean;
  deleteReason?: string;
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
  onContinuar?: (cotacao: CotacaoWithRelations) => void;
  onExcluir: (id: string) => void;
  copiandoWhatsAppId: string | null;
  getPermissions: (cotacao: CotacaoWithRelations) => CotacoesTablePermissions;
  selectable?: boolean;
  selectedIds?: Set<string>;
  onToggleSelect?: (id: string) => void;
  onToggleAll?: () => void;
  groupByDate?: boolean;
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
  onContinuar,
  onExcluir,
  copiandoWhatsAppId,
  getPermissions,
  selectable = false,
  selectedIds,
  onToggleSelect,
  onToggleAll,
  groupByDate = false,
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
            {(() => {
              let lastDateKey = '';
              return cotacoes.map((cotacao) => {
                const dateKey = groupByDate ? format(new Date(cotacao.updated_at || cotacao.created_at), 'yyyy-MM-dd') : '';
                const showDateHeader = groupByDate && dateKey !== lastDateKey;
                if (showDateHeader) lastDateKey = dateKey;
                const colSpan = (selectable ? 1 : 0) + 7;

                return (
                  <>
                    {showDateHeader && (
                      <TableRow key={`date-${dateKey}`} className="bg-muted/60 hover:bg-muted/60">
                        <TableCell colSpan={colSpan} className="py-2 px-4">
                          <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                            📅 {format(new Date(dateKey), "dd/MM/yyyy (EEEE)", { locale: ptBR })}
                          </span>
                        </TableCell>
                      </TableRow>
                    )}
                    {(() => {
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
                      {(() => {
                        const prio = (cotacao as any).prioridade as string | undefined;
                        if (prio && prio !== 'normal') {
                          const isUrg = prio === 'urgente';
                          return (
                            <Badge
                              className={cn(
                                'font-bold border-0 text-[10px] px-2 py-0.5 w-fit rounded-full animate-pulse',
                                isUrg
                                  ? 'bg-red-500/20 text-red-700 dark:text-red-300'
                                  : 'bg-orange-500/20 text-orange-700 dark:text-orange-300',
                              )}
                            >
                              ⚡ Prioridade {isUrg ? 'URGENTE' : 'ALTA'}
                            </Badge>
                          );
                        }
                        return null;
                      })()}
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
                      <TrocaTitularidadeBadge
                        cotacaoId={cotacao.id}
                        tipoEntrada={(cotacao.dados_extras as any)?.tipo_entrada ?? null}
                      />
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
                      <div className="flex items-center gap-1.5 min-w-0" title={cotacao.vendedor.nome}>
                        <UserAvatar name={cotacao.vendedor.nome} size="sm" className="h-5 w-5 text-[9px] shrink-0" />
                        <span className="text-xs truncate text-muted-foreground">{cotacao.vendedor.nome}</span>
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
                      {cotacao.token_publico && (
                        <>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-8 w-8 hover:bg-muted"
                                onClick={() => {
                                  const link = `${window.location.origin}/cotacao/${cotacao.token_publico}`;
                                  window.open(link, '_blank');
                                }}
                              >
                                <ExternalLink className="h-4 w-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Acessar Link</TooltipContent>
                          </Tooltip>
                          
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-8 w-8 hover:bg-muted"
                                onClick={() => {
                                  const link = `${window.location.origin}/cotacao/${cotacao.token_publico}`;
                                  navigator.clipboard.writeText(link);
                                  toast.success('Link copiado!');
                                }}
                              >
                                <Link2 className="h-4 w-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Copiar Link</TooltipContent>
                          </Tooltip>
                        </>
                      )}
                      
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
                          {cotacao.status === 'rascunho' && onContinuar && (
                            <DropdownMenuItem onClick={() => onContinuar(cotacao)}>
                              <ArrowRight className="h-4 w-4 mr-2" />
                              Continuar cotação
                            </DropdownMenuItem>
                          )}

                          <DropdownMenuItem onClick={() => onRowClick(cotacao)}>
                            <Eye className="h-4 w-4 mr-2" />
                            Ver Detalhes
                          </DropdownMenuItem>
                          
                          <DropdownMenuItem 
                            onClick={() => onCopiarWhatsApp(cotacao)}
                            disabled={isCopiando || permissions.canSend === false}
                          >
                            <ClipboardCopy className="h-4 w-4 mr-2" />
                            Copiar para WhatsApp
                          </DropdownMenuItem>
                          
                          {permissions.canDuplicate && (
                            <>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem onClick={() => onDuplicar(cotacao)}>
                                <FileText className="h-4 w-4 mr-2" />
                                Duplicar
                              </DropdownMenuItem>
                            </>
                          )}

                          {(cotacao.dados_extras as any)?.tipo_entrada === 'troca_titularidade' && (
                            <>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                onClick={async () => {
                                  const { data } = await (await import('@/integrations/supabase/client')).supabase
                                    .from('solicitacoes_troca_titularidade' as any)
                                    .select('termo_cancelamento_url')
                                    .eq('cotacao_id', cotacao.id)
                                    .maybeSingle();
                                  const url = (data as any)?.termo_cancelamento_url;
                                  if (!url) {
                                    toast.error('Link do termo ainda não disponível');
                                    return;
                                  }
                                  await navigator.clipboard.writeText(url);
                                  toast.success('Link do termo copiado!');
                                }}
                              >
                                <Link2 className="h-4 w-4 mr-2" />
                                Copiar link do termo
                              </DropdownMenuItem>
                            </>
                          )}

                          <DropdownMenuSeparator />
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="w-full">
                                <DropdownMenuItem 
                                  disabled={!permissions.canDelete}
                                  onClick={permissions.canDelete ? () => onExcluir(cotacao.id) : undefined}
                                  className="text-destructive focus:text-destructive"
                                >
                                  <X className="h-4 w-4 mr-2" />
                                  Excluir
                                </DropdownMenuItem>
                              </span>
                            </TooltipTrigger>
                            {!permissions.canDelete && permissions.deleteReason && (
                              <TooltipContent side="left">
                                {permissions.deleteReason}
                              </TooltipContent>
                            )}
                          </Tooltip>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </TableCell>
                </TableRow>
                    );
                    })()}
                  </>
                );
              });
            })()}
          </TableBody>
        </Table>
      </div>
    </TooltipProvider>
  );
}
