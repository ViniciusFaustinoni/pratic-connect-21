import { useNavigate } from 'react-router-dom';
import {
  Phone, Mail, MessageCircle, Edit, Pause, Play, Map,
  MoreHorizontal, XCircle, DollarSign, AlertTriangle, Shield,
  ArrowLeftRight, Loader2, Radio, RefreshCw, FileCheck, Users,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

interface AssociadoHeroHeaderProps {
  associado: any;
  status: string;
  statusLabel: string;
  statusColor: string;
  contrato: any;
  resumoFinanceiro: any;
  veiculosComRastreador: any[] | undefined;
  statusPlataforma: any;
  permissions: {
    isAnalistaCadastroOnly: boolean;
    isDiretor: boolean;
    isGerencia: boolean;
    isDesenvolvedor: boolean;
    isAdminMaster: boolean;
  };
  docsPendentes: number;
  coberturasSuspensas?: boolean;
  // Actions
  onSuspender: () => void;
  onReativar: () => void;
  onCancelar: () => void;
  onAbrirMapa: () => void;
  onWhatsApp: () => void;
  onEmail: () => void;
  onSincronizar: () => void;
  onExcluir: (tipo: string) => void;
  onTrocaTitularidade?: () => void;
  setActiveTab: (tab: string) => void;
  // Loading states
  isReativando: boolean;
  isSincronizando: boolean;
}

const getInitials = (nome: string) => {
  const p = nome.split(' ');
  return p.length >= 2 ? `${p[0][0]}${p[p.length - 1][0]}`.toUpperCase() : nome.slice(0, 2).toUpperCase();
};

const formatPhone = (phone: string | null) => {
  if (!phone) return '—';
  const d = phone.replace(/\D/g, '');
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return phone;
};

const formatCPFMasked = (cpf: string | null) => {
  if (!cpf) return '—';
  const d = cpf.replace(/\D/g, '');
  return d.length === 11 ? `***.${d.slice(3, 6)}.***-${d.slice(9)}` : cpf;
};

const formatDateShort = (d: string | null | undefined) =>
  d ? new Date(d).toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' }) : '—';

const formatCurrency = (v: number | null | undefined) =>
  v ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v) : 'R$ 0,00';

export function AssociadoHeroHeader({
  associado, status, statusLabel, statusColor, contrato, resumoFinanceiro,
  veiculosComRastreador, statusPlataforma, permissions, docsPendentes, coberturasSuspensas,
  onSuspender, onReativar, onCancelar, onAbrirMapa, onWhatsApp, onEmail,
  onSincronizar, onExcluir, setActiveTab, isReativando, isSincronizando,
}: AssociadoHeroHeaderProps) {
  const navigate = useNavigate();
  const id = associado.id;

  const tempoAssociado = associado.data_adesao
    ? `Desde ${formatDateShort(associado.data_adesao)}`
    : '';

  return (
    <div className="rounded-xl border bg-card overflow-hidden">
      {/* Top accent bar */}
      <div className={cn(
        'h-1.5',
        status === 'ativo' && 'bg-emerald-500',
        status === 'suspenso' && 'bg-amber-500',
        status === 'cancelado' && 'bg-destructive',
        status === 'em_analise' && 'bg-blue-500',
        !['ativo', 'suspenso', 'cancelado', 'em_analise'].includes(status) && 'bg-muted-foreground',
      )} />

      <div className="p-5 sm:p-6">
        {/* Row 1: Avatar + Info + Quick Contact */}
        <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-5">
          <div className="flex items-start gap-4">
            <Avatar className="h-14 w-14 sm:h-16 sm:w-16 ring-2 ring-primary/20 ring-offset-2 ring-offset-card shrink-0">
              <AvatarFallback className="bg-primary text-primary-foreground text-lg sm:text-xl font-bold">
                {getInitials(associado.nome)}
              </AvatarFallback>
            </Avatar>

            <div className="min-w-0 space-y-1.5">
              <div className="flex items-center gap-2.5 flex-wrap">
                <h1 className="text-xl sm:text-2xl font-bold tracking-tight truncate">{associado.nome}</h1>
                <Badge className={cn('text-xs font-semibold shrink-0', statusColor)}>
                  {statusLabel}
                </Badge>
                {statusPlataforma?.dados?.veiculosVinculados > 0 && (
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Badge variant="outline" className={cn(
                          'text-[10px] shrink-0',
                          statusPlataforma.sincronizado
                            ? 'border-blue-400/50 text-blue-600 dark:text-blue-400'
                            : 'border-destructive/50 text-destructive',
                        )}>
                          <Radio className="h-2.5 w-2.5 mr-1" />
                          {statusPlataforma.sincronizado ? 'Rede Veículos' : 'Dessincronizado'}
                        </Badge>
                      </TooltipTrigger>
                      <TooltipContent side="bottom" className="text-xs">
                        <p>Veículos ativos: {statusPlataforma.dados.veiculosAtivos}</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                )}
              </div>

              <div className="flex items-center gap-3 text-sm text-muted-foreground flex-wrap">
                <span className="font-mono text-xs">{formatCPFMasked(associado.cpf)}</span>
                <span className="hidden sm:inline text-border">•</span>
                <span className="hidden sm:inline">{tempoAssociado}</span>
                {contrato?.valor_mensal && (
                  <>
                    <span className="hidden sm:inline text-border">•</span>
                    <span className="hidden sm:inline font-medium text-foreground">{formatCurrency(contrato.valor_mensal)}/mês</span>
                  </>
                )}
              </div>

              {/* Quick contact row */}
              <div className="flex items-center gap-1.5 pt-1">
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-green-600" onClick={onWhatsApp}>
                        <MessageCircle className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>{formatPhone(associado.telefone)}</TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-blue-600" onClick={() => window.open(`tel:${associado.telefone}`)}>
                        <Phone className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>{formatPhone(associado.telefone)}</TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-primary" onClick={onEmail}>
                        <Mail className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>{associado.email}</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
                <span className="text-xs text-muted-foreground ml-1 hidden sm:inline">{associado.email}</span>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2 flex-wrap shrink-0">
            {!permissions.isAnalistaCadastroOnly && (
              <Button size="sm" variant="outline" onClick={() => navigate(`/cadastro/associados/${id}/editar`)}>
                <Edit className="h-3.5 w-3.5 mr-1.5" /> Editar
              </Button>
            )}
            <Button size="sm" variant="outline" onClick={onAbrirMapa}
              disabled={!veiculosComRastreador || veiculosComRastreador.length === 0}>
              <Map className="h-3.5 w-3.5 mr-1.5" /> Mapa
            </Button>
            {status === 'ativo' && (
              <Button size="sm" variant="outline" onClick={() => navigate(`/cadastro/associados/${id}/substituicao`)}>
                <ArrowLeftRight className="h-3.5 w-3.5 mr-1.5" /> Substituir
              </Button>
            )}
            {status === 'ativo' && (
              <Button size="sm" variant="outline" className="text-amber-600 hover:text-amber-700 hover:border-amber-300" onClick={onSuspender}>
                <Pause className="h-3.5 w-3.5 mr-1.5" /> Suspender
              </Button>
            )}
            {(status === 'suspenso' || coberturasSuspensas) && (
              <Button size="sm" variant="outline" className="text-emerald-600 hover:text-emerald-700 hover:border-emerald-300" onClick={onReativar} disabled={isReativando}>
                {isReativando ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Play className="h-3.5 w-3.5 mr-1.5" />}
                Reativar
              </Button>
            )}

            {/* Sync button */}
            {statusPlataforma?.dados?.veiculosVinculados > 0 && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button size="icon" variant="ghost" className="h-8 w-8" onClick={onSincronizar} disabled={isSincronizando}>
                      {isSincronizando ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Sincronizar Rede Veículos</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}

            {/* More menu */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                {!permissions.isAnalistaCadastroOnly && (
                  <DropdownMenuItem onClick={() => setActiveTab('documentos')}>
                    <FileCheck className="mr-2 h-4 w-4" /> Documentos
                    {docsPendentes > 0 && <Badge variant="destructive" className="ml-auto h-5 px-1.5 text-[10px]">{docsPendentes}</Badge>}
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem onClick={() => setActiveTab('financeiro')}>
                  <DollarSign className="mr-2 h-4 w-4" /> Financeiro
                </DropdownMenuItem>
                <DropdownMenuItem onClick={onWhatsApp}>
                  <MessageCircle className="mr-2 h-4 w-4" /> WhatsApp
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={onCancelar} className="text-destructive focus:text-destructive">
                  <XCircle className="mr-2 h-4 w-4" /> Cancelar Associação
                </DropdownMenuItem>
                {(permissions.isDiretor || permissions.isGerencia || permissions.isDesenvolvedor || permissions.isAdminMaster) && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => onExcluir('inadimplencia')} className="text-orange-600 focus:text-orange-600">
                      <DollarSign className="mr-2 h-4 w-4" /> Excluir por Inadimplência
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => onExcluir('exclusao_diretoria')} className="text-destructive focus:text-destructive">
                      <AlertTriangle className="mr-2 h-4 w-4" /> Excluir por Diretoria
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => onExcluir('busca_apreensao')} className="text-red-900 focus:text-red-900">
                      <Shield className="mr-2 h-4 w-4" /> Busca e Apreensão
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>
    </div>
  );
}
