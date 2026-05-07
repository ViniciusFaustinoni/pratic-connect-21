import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, ArrowRightLeft, RefreshCw, AlertTriangle, ExternalLink, FileText, CheckCircle2, Clock, Ban, Send, Eye, ChevronRight, User, MessageCircle, MailWarning } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { useOutrosProcessos, TIPO_LABELS, TONE_CLASS, type TipoOutroProcesso, type OutroProcessoItem, TIPOS_OUTROS_PROCESSOS } from '@/hooks/useOutrosProcessos';
import { useEnviarTermoCancelamento } from '@/hooks/useSolicitacoesTroca';
import { useAuth } from '@/contexts/AuthContext';
import { usePermissions } from '@/hooks/usePermissions';
import { useVendedores } from '@/hooks/useVendedores';
import { TrocaTimelineDrawer } from '@/components/cotacoes/TrocaTimelineDrawer';
import { cn } from '@/lib/utils';

function formatCurrency(value: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

function TermoIcon({ status }: { status: OutroProcessoItem['termo_status'] }) {
  const map = {
    nao_aplicavel: { icon: null as any, label: '', cls: '' },
    pendente: { icon: Clock, label: 'Termo pendente', cls: 'text-amber-600' },
    enviado: { icon: Send, label: 'Termo enviado', cls: 'text-blue-600' },
    assinado: { icon: CheckCircle2, label: 'Termo assinado', cls: 'text-emerald-600' },
    recusado: { icon: Ban, label: 'Termo recusado / cancelado', cls: 'text-red-600' },
  } as const;
  const cfg = map[status];
  if (!cfg.icon) return null;
  const Icon = cfg.icon;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Icon className={cn('h-4 w-4', cfg.cls)} aria-label={cfg.label} />
      </TooltipTrigger>
      <TooltipContent>{cfg.label}</TooltipContent>
    </Tooltip>
  );
}

interface OutrosProcessosPanelProps {
  className?: string;
}

export function OutrosProcessosPanel({ className }: OutrosProcessosPanelProps) {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const permissions = usePermissions();
  const [search, setSearch] = useState('');
  const [tipoFilter, setTipoFilter] = useState<'all' | TipoOutroProcesso>('all');
  const [consultorFilter, setConsultorFilter] = useState<string>('all');
  const [drawerItem, setDrawerItem] = useState<OutroProcessoItem | null>(null);
  const [resendItem, setResendItem] = useState<OutroProcessoItem | null>(null);

  const enviarTermo = useEnviarTermoCancelamento();

  const { data: vendedores } = useVendedores({
    enabled: permissions.cotacao.viewScope !== 'own',
  });

  const { data, isLoading, isFetching, refetch } = useOutrosProcessos({
    vendedorId: permissions.userId,
    viewScope: permissions.cotacao.viewScope,
    consultorId: consultorFilter !== 'all' ? consultorFilter : null,
    searchTerm: search,
    tipos: tipoFilter === 'all' ? TIPOS_OUTROS_PROCESSOS : [tipoFilter],
  });

  const items = data || [];

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: items.length };
    items.forEach((i) => { c[i.tipo] = (c[i.tipo] || 0) + 1; });
    return c;
  }, [items]);

  const handleAbrirCotacao = (item: OutroProcessoItem) => {
    if (item.cotacao_token) window.open(`/cotacao/${item.cotacao_token}`, '_blank');
  };

  const handleVerDetalhe = (item: OutroProcessoItem) => {
    if (item.tipo === 'troca_titularidade') {
      setDrawerItem(item);
    } else {
      navigate(`/vendas/cotacoes?cotacao=${item.cotacao_id}`);
    }
  };

  const handleConfirmReenvio = async () => {
    if (!resendItem?.solicitacao_troca_id) return;
    const isResend = !!resendItem.termo_enviado_em;
    await enviarTermo.mutateAsync({ solicitacao_id: resendItem.solicitacao_troca_id, force_resend: isResend });
    setResendItem(null);
    refetch();
  };

  return (
    <div className={cn('space-y-4', className)}>
      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-2 px-4 py-3 rounded-xl bg-muted/30 border border-border/40">
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/70" />
          <Input
            placeholder="Buscar nome, CPF, placa, número..."
            className="pl-9 h-9 border-0 bg-background/80 shadow-sm focus-visible:ring-1"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <Select value={tipoFilter} onValueChange={(v) => setTipoFilter(v as any)}>
          <SelectTrigger className="w-[200px] h-9 border-0 bg-background/80 shadow-sm">
            <SelectValue placeholder="Tipo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os tipos · {counts.all || 0}</SelectItem>
            {TIPOS_OUTROS_PROCESSOS.map((t) => (
              <SelectItem key={t} value={t}>
                {TIPO_LABELS[t].label} · {counts[t] || 0}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {permissions.cotacao.viewScope !== 'own' && (
          <Select value={consultorFilter} onValueChange={setConsultorFilter}>
            <SelectTrigger className="w-[180px] h-9 border-0 bg-background/80 shadow-sm">
              <User className="h-4 w-4 mr-1.5 text-muted-foreground" />
              <SelectValue placeholder="Consultor" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos consultores</SelectItem>
              {vendedores?.map((v: any) => (
                <SelectItem key={v.user_id} value={v.user_id}>{v.nome}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        <Button variant="ghost" size="sm" onClick={() => refetch()} className="h-9 ml-auto">
          <RefreshCw className={cn('h-3.5 w-3.5 mr-1', isFetching && 'animate-spin')} />
          Atualizar
        </Button>
      </div>

      {/* Lista */}
      {isLoading ? (
        <Card><CardContent className="py-12 text-center text-sm text-muted-foreground">Carregando...</CardContent></Card>
      ) : items.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <ArrowRightLeft className="h-10 w-10 mx-auto text-muted-foreground/40 mb-3" />
            <p className="text-sm font-medium">Nenhum processo em andamento</p>
            <p className="text-xs text-muted-foreground mt-1">
              Trocas de titularidade, substituições, inclusões e migrações que você criar aparecem aqui.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="rounded-xl border border-border/40 bg-card overflow-hidden">
          <div className="grid grid-cols-[1fr_2fr_1.5fr_1fr_1.5fr_auto] gap-3 px-4 py-2.5 bg-muted/40 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
            <div>Tipo</div>
            <div>Origem → Destino</div>
            <div>Veículo</div>
            <div>Consultor</div>
            <div>Etapa</div>
            <div className="text-right">Ações</div>
          </div>
          <div className="divide-y divide-border/40">
            {items.map((item) => (
              <div
                key={item.id}
                className="grid grid-cols-[1fr_2fr_1.5fr_1fr_1.5fr_auto] gap-3 px-4 py-3 items-center hover:bg-muted/20 transition-colors"
              >
                {/* Tipo */}
                <div className="flex flex-col gap-1 min-w-0">
                  <Badge className={cn(TIPO_LABELS[item.tipo].chip, 'border-0 text-[10px] px-2 py-0.5 rounded-full w-fit')}>
                    {TIPO_LABELS[item.tipo].label}
                  </Badge>
                  <span className="text-[10px] text-muted-foreground truncate">
                    {item.cotacao_numero ?? '—'} · {formatDistanceToNow(new Date(item.created_at), { addSuffix: true, locale: ptBR })}
                  </span>
                </div>

                {/* Origem -> destino */}
                <div className="text-sm min-w-0">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="font-medium truncate" title={item.titular_origem_nome ?? ''}>
                      {item.titular_origem_nome || '—'}
                    </span>
                    {item.titular_destino_nome && (
                      <>
                        <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                        <span className="font-medium truncate" title={item.titular_destino_nome}>
                          {item.titular_destino_nome}
                        </span>
                      </>
                    )}
                  </div>
                  {item.pendencia_qtd > 0 && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Badge className="bg-red-500/15 text-red-700 dark:text-red-300 border-0 text-[10px] px-2 py-0.5 rounded-full mt-1 cursor-help">
                          <AlertTriangle className="h-2.5 w-2.5 mr-1" />
                          Pendência financeira
                        </Badge>
                      </TooltipTrigger>
                      <TooltipContent>
                        {item.pendencia_qtd} boleto(s) em aberto · {formatCurrency(item.pendencia_total)}
                      </TooltipContent>
                    </Tooltip>
                  )}
                </div>

                {/* Veículo */}
                <div className="text-sm min-w-0">
                  <div className="font-mono font-medium">{item.veiculo_placa || '—'}</div>
                  <div className="text-xs text-muted-foreground truncate">
                    {item.veiculo_marca} {item.veiculo_modelo} {item.veiculo_ano ?? ''}
                  </div>
                </div>

                {/* Consultor */}
                <div className="text-xs text-muted-foreground truncate" title={item.vendedor_nome ?? ''}>
                  {item.vendedor_nome || '—'}
                </div>

                {/* Etapa */}
                <div className="flex items-center gap-2 min-w-0">
                  <Badge className={cn(TONE_CLASS[item.etapa_tone], 'border-0 text-[10px] px-2 py-0.5 rounded-full')}>
                    {item.etapa_label}
                  </Badge>
                  <TermoIcon status={item.termo_status} />
                </div>

                {/* Ações */}
                <div className="flex items-center gap-1 justify-end shrink-0">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => handleVerDetalhe(item)}>
                        <Eye className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Ver detalhes</TooltipContent>
                  </Tooltip>

                  {item.cotacao_token && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => handleAbrirCotacao(item)}>
                          <ExternalLink className="h-4 w-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Abrir página da cotação</TooltipContent>
                    </Tooltip>
                  )}

                  {item.tipo === 'troca_titularidade' && item.solicitacao_troca_id &&
                    (item.termo_status === 'pendente' || item.termo_status === 'enviado') && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8"
                            disabled={enviarTermo.isPending}
                            onClick={() => handleReenviarTermo(item)}
                          >
                            <Send className="h-4 w-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          {item.termo_status === 'enviado' ? 'Reenviar termo de cancelamento' : 'Enviar termo de cancelamento'}
                        </TooltipContent>
                      </Tooltip>
                    )}

                  {item.termo_url && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => window.open(item.termo_url!, '_blank')}>
                          <FileText className="h-4 w-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Ver termo de cancelamento</TooltipContent>
                    </Tooltip>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
