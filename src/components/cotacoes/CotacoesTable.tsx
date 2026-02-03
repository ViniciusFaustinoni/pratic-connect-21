import { useState } from 'react';
import { format, formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { FileText, Send, Check, X, Eye, Car, Phone, User, MoreHorizontal, ClipboardCopy, ExternalLink, Link2, FileDown, Loader2 } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
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
  | 'realizando_pagamento'
  | 'assinando_contrato'
  | 'vistoria_agendada'
  | 'instalacao_agendada'
  | 'realizando_vistoria'
  | 'vistoria_realizada'
  | 'associado_ativo';

const statusConfig: Record<StatusCotacaoExtended, { 
  label: string; 
  color: string;
  bgColor: string;
  icon: typeof FileText 
}> = {
  rascunho: { 
    label: 'Rascunho', 
    color: 'text-yellow-600 dark:text-yellow-400', 
    bgColor: 'bg-yellow-500/20',
    icon: FileText 
  },
  enviada: { 
    label: 'Enviada', 
    color: 'text-blue-600 dark:text-blue-400', 
    bgColor: 'bg-blue-500/20',
    icon: Send 
  },
  visualizada: { 
    label: 'Visualizada', 
    color: 'text-cyan-600 dark:text-cyan-400', 
    bgColor: 'bg-cyan-500/20',
    icon: Eye 
  },
  aceita: { 
    label: 'Aceita', 
    color: 'text-green-600 dark:text-green-400', 
    bgColor: 'bg-green-500/20',
    icon: Check 
  },
  recusada: { 
    label: 'Recusada', 
    color: 'text-red-600 dark:text-red-400', 
    bgColor: 'bg-red-500/20',
    icon: X 
  },
  expirada: { 
    label: 'Expirada', 
    color: 'text-muted-foreground', 
    bgColor: 'bg-muted',
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

// Função para determinar a etapa da venda - CORRIGIDA para vistoria agendada
export const getEtapaVenda = (cotacao: CotacaoWithRelations): EtapaVenda | null => {
  const statusContratacao = cotacao.status_contratacao;
  const temContratacaoAtiva = statusContratacao && 
    statusContratacao !== 'aguardando' && 
    statusContratacao !== null;
  
  if (cotacao.status === 'rascunho' && !temContratacaoAtiva && !cotacao.contrato) return null;
  
  // PRIORIDADE 1: Verificar se associado está ativo
  const associadoStatus = cotacao.contrato?.associados?.status;
  if (associadoStatus === 'ativo') return 'associado_ativo';
  
  // PRIORIDADE 2: Verificar status da instalação/vistoria
  const instalacao = cotacao.instalacoes?.[0];
  if (instalacao) {
    if (instalacao.status === 'concluida') return 'vistoria_realizada';
    if (instalacao.status === 'em_andamento' || instalacao.status === 'em_rota') return 'realizando_vistoria';
    if (instalacao.status === 'agendada' || instalacao.status === 'reagendada') {
      const tipoVistoria = cotacao.tipo_vistoria;
      if (tipoVistoria === 'autovistoria') return 'instalacao_agendada';
      return 'vistoria_agendada';
    }
  }
  
  // PRIORIDADE 3: Verificar status_contratacao - CORRIGIDO para vistoria agendada
  if (statusContratacao === 'pagamento_ok') return 'assinando_contrato';
  
  // CORREÇÃO: Quando vistoria_ok com tipo agendada, mostrar vistoria_agendada
  if (statusContratacao === 'vistoria_ok') {
    const tipoVistoria = cotacao.tipo_vistoria;
    if (tipoVistoria === 'agendada' && cotacao.vistoria_data_agendada) {
      return 'vistoria_agendada';
    }
    return 'realizando_pagamento';
  }
  
  if (statusContratacao === 'contrato_assinado' || statusContratacao === 'contrato_gerado') {
    const adesaoPaga = cotacao.contrato?.adesao_paga;
    if (adesaoPaga === false) return 'realizando_pagamento';
    return 'vistoria_agendada';
  }
  if (statusContratacao === 'documentos_ok') return 'escolha_vistoria';
  if (statusContratacao === 'dados_preenchidos') return 'enviando_documentos';
  if (statusContratacao === 'plano_escolhido') return 'escolhendo_plano';
  
  // PRIORIDADE 4: Verificar status do contrato
  const contratoStatus = cotacao.contrato?.status;
  const adesaoPaga = cotacao.contrato?.adesao_paga;
  
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
}: CotacoesTableProps) {
  const formatRelativeTime = (dateStr: string) => {
    return formatDistanceToNow(new Date(dateStr), { addSuffix: true, locale: ptBR });
  };

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
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <FileText className="h-12 w-12 text-muted-foreground/50 mb-4" />
        <p className="text-muted-foreground font-medium">Nenhuma cotação encontrada</p>
        <p className="text-sm text-muted-foreground">Ajuste os filtros ou crie uma nova cotação</p>
      </div>
    );
  }

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[180px]">Status / Etapa</TableHead>
            <TableHead>Cliente</TableHead>
            <TableHead className="hidden md:table-cell">Veículo</TableHead>
            <TableHead className="hidden lg:table-cell">Valor FIPE</TableHead>
            <TableHead className="hidden lg:table-cell">Consultor</TableHead>
            <TableHead className="hidden sm:table-cell">Data</TableHead>
            <TableHead className="w-[120px]">Ações</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {cotacoes.map((cotacao) => {
            const status = statusConfig[cotacao.status as StatusCotacaoExtended] || statusConfig.rascunho;
            const etapaVenda = getEtapaVenda(cotacao);
            const etapaInfo = etapaVenda ? etapaVendaConfig[etapaVenda] : null;
            const permissions = getPermissions(cotacao);
            const isCopiando = copiandoWhatsAppId === cotacao.id;
            
            return (
              <TableRow 
                key={cotacao.id}
                className="cursor-pointer hover:bg-muted/50"
                onClick={() => onRowClick(cotacao)}
              >
                {/* Status / Etapa */}
                <TableCell>
                  <div className="flex flex-col gap-1">
                    <Badge className={cn(status.bgColor, status.color, "font-medium border-0 text-[10px] w-fit")}>
                      <status.icon className="h-3 w-3 mr-1" />
                      {status.label.toUpperCase()}
                    </Badge>
                    {etapaInfo && (
                      <Badge className={cn(etapaInfo.bgColor, etapaInfo.color, "font-medium border-0 text-[10px] w-fit")}>
                        {etapaInfo.label}
                      </Badge>
                    )}
                  </div>
                </TableCell>
                
                {/* Cliente */}
                <TableCell>
                  <div className="flex items-center gap-2">
                    <div className={cn(
                      "flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-medium",
                      "bg-primary/10 text-primary"
                    )}>
                      {cotacao.leads?.nome?.charAt(0).toUpperCase() || cotacao.nome_solicitante?.charAt(0).toUpperCase() || <User className="h-4 w-4" />}
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium truncate text-sm">
                        {cotacao.leads?.nome || cotacao.nome_solicitante || 'Sem nome'}
                      </p>
                      {cotacao.leads?.telefone && (
                        <p className="text-xs text-muted-foreground flex items-center gap-1">
                          <Phone className="h-3 w-3" />
                          {formatPhone(cotacao.leads.telefone)}
                        </p>
                      )}
                    </div>
                  </div>
                </TableCell>
                
                {/* Veículo */}
                <TableCell className="hidden md:table-cell">
                  <div className="flex items-center gap-2">
                    <Car className="h-4 w-4 text-muted-foreground" />
                    <div className="min-w-0">
                      <p className="text-sm truncate">
                        {cotacao.veiculo_marca} {cotacao.veiculo_modelo}
                      </p>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">{cotacao.veiculo_ano}</span>
                        {cotacao.veiculo_placa && (
                          <Badge variant="outline" className="font-mono text-[10px] px-1 py-0">
                            {cotacao.veiculo_placa}
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                </TableCell>
                
                {/* Valor FIPE */}
                <TableCell className="hidden lg:table-cell">
                  <span className="font-medium text-sm">{formatCurrency(cotacao.valor_fipe)}</span>
                </TableCell>
                
                {/* Consultor */}
                <TableCell className="hidden lg:table-cell">
                  {cotacao.vendedor?.nome && (
                    <div className="flex items-center gap-2">
                      <UserAvatar name={cotacao.vendedor.nome} size="sm" />
                      <span className="text-sm truncate max-w-[100px]">{cotacao.vendedor.nome}</span>
                    </div>
                  )}
                </TableCell>
                
                {/* Data */}
                <TableCell className="hidden sm:table-cell">
                  <div className="text-sm">
                    <p>{format(new Date(cotacao.created_at), 'dd/MM/yy')}</p>
                    <p className="text-xs text-muted-foreground">{formatRelativeTime(cotacao.created_at)}</p>
                  </div>
                </TableCell>
                
                {/* Ações */}
                <TableCell onClick={(e) => e.stopPropagation()}>
                  <div className="flex items-center gap-1">
                    {/* Copiar para WhatsApp */}
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 text-green-600 hover:text-green-700 hover:bg-green-100"
                      onClick={() => onCopiarWhatsApp(cotacao)}
                      disabled={isCopiando || permissions.canSend === false}
                      title="Copiar para WhatsApp"
                    >
                      {isCopiando ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <ClipboardCopy className="h-4 w-4" />
                      )}
                    </Button>
                    
                    {/* Baixar PDF */}
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8"
                      onClick={() => onPdf(cotacao)}
                      title="Baixar PDF"
                    >
                      <FileDown className="h-4 w-4" />
                    </Button>
                    
                    {/* Menu de ações extras */}
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button size="icon" variant="ghost" className="h-8 w-8">
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
  );
}
