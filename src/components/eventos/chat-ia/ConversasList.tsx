import { useState, useMemo, useEffect, useRef } from 'react';
import { Search, User, Bot, Loader2, MessageSquare, AlertCircle, CheckCheck } from 'lucide-react';
import { formatDistanceToNowStrict } from 'date-fns';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { UserAvatar } from '@/components/UserAvatar';
import { cn } from '@/lib/utils';
import { useMetaConfig, useTestarMetaConexao } from '@/hooks/useWhatsAppMeta';
import { useEffect, useRef } from 'react';

function formatPhoneBR(raw: string | null | undefined): string {
  if (!raw) return '';
  const d = raw.replace(/\D/g, '');
  // Esperado: 55 21 98579 1044 (13) ou 55 21 8579 1044 (12)
  if (d.length === 13) return `+${d.slice(0, 2)} (${d.slice(2, 4)}) ${d.slice(4, 9)}-${d.slice(9)}`;
  if (d.length === 12) return `+${d.slice(0, 2)} (${d.slice(2, 4)}) ${d.slice(4, 8)}-${d.slice(8)}`;
  return raw;
}

export interface ConversaAgrupada {
  telefone: string;
  nome_contato: string | null;
  avatar_url: string | null;
  total_mensagens: number;
  ultima_mensagem: string;
  ultima_msg_texto: string | null;
  ultima_direcao: string;
  /** Timestamp da última mensagem de cobrança (referencia_tipo IN ('cobranca','cobranca_csv')). Null = nunca recebeu cobrança. */
  ultima_cobranca: string | null;
  /** Mensagens recebidas (direcao='entrada') ainda não lidas pelo operador atual. */
  unread_count: number;
  /** Quando preenchido, indica que a IA está pausada por transbordo (intervenção humana solicitada). */
  transbordo?: { motivo: string } | null;
}

interface ConversasListProps {
  conversas: ConversaAgrupada[];
  isLoading: boolean;
  telefoneSelecionado: string | null;
  onSelectConversa: (conversa: ConversaAgrupada) => void;
  onMarcarTodasLidas?: () => void;
}

const formatarData = (dataStr: string) => {
  const data = new Date(dataStr);
  const hoje = new Date();
  const ontem = new Date(hoje);
  ontem.setDate(ontem.getDate() - 1);

  if (data.toDateString() === hoje.toDateString()) {
    return format(data, 'HH:mm');
  }
  if (data.toDateString() === ontem.toDateString()) {
    return 'Ontem';
  }
  return format(data, 'dd/MM/yy', { locale: ptBR });
};

const formatarTelefone = (tel: string) => {
  const limpo = tel.replace(/\D/g, '');
  if (limpo.length === 13) {
    return `+${limpo.slice(0, 2)} (${limpo.slice(2, 4)}) ${limpo.slice(4, 9)}-${limpo.slice(9)}`;
  }
  if (limpo.length === 12) {
    return `+${limpo.slice(0, 2)} (${limpo.slice(2, 4)}) ${limpo.slice(4, 8)}-${limpo.slice(8)}`;
  }
  return tel;
};

export function ConversasList({ conversas, isLoading, telefoneSelecionado, onSelectConversa, onMarcarTodasLidas }: ConversasListProps) {
  const [busca, setBusca] = useState('');
  const [filtro, setFiltro] = useState<'todas' | 'nao_lidos'>('todas');

  const totalNaoLidos = useMemo(
    () => conversas.reduce((acc, c) => acc + (c.unread_count > 0 ? 1 : 0), 0),
    [conversas]
  );

  const conversasFiltradas = useMemo(() => {
    let base = conversas;
    if (filtro === 'nao_lidos') {
      base = base.filter((c) => c.unread_count > 0);
    }
    if (busca.trim()) {
      const termo = busca.toLowerCase();
      base = base.filter(
        (c) =>
          c.telefone.includes(termo) ||
          c.nome_contato?.toLowerCase().includes(termo)
      );
    }
    if (filtro === 'nao_lidos') {
      // já é tudo não-lido; mantém ordenação por última msg
      return base;
    }
    // Não lidos no topo, restante por recência
    return [...base].sort((a, b) => {
      const an = a.unread_count > 0 ? 1 : 0;
      const bn = b.unread_count > 0 ? 1 : 0;
      if (an !== bn) return bn - an;
      return new Date(b.ultima_mensagem).getTime() - new Date(a.ultima_mensagem).getTime();
    });
  }, [conversas, busca, filtro]);

  return (
    <div className="flex flex-col h-full border-r border-border">
      {/* Header */}
      <div className="p-3 border-b border-border space-y-2">
        <h2 className="font-semibold text-sm flex items-center gap-2">
          <MessageSquare className="h-4 w-4 text-primary" />
          Conversas IA
          {conversas.length > 0 && (
            <Badge variant="secondary" className="text-[10px]">{conversas.length}</Badge>
          )}
          {totalNaoLidos > 0 && (
            <Badge className="text-[10px] bg-emerald-600 hover:bg-emerald-600">
              {totalNaoLidos} não lida{totalNaoLidos > 1 ? 's' : ''}
            </Badge>
          )}
        </h2>
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Buscar nome ou telefone..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            className="pl-8 h-8 text-sm"
          />
        </div>
        <div className="flex items-center justify-between gap-2">
          <ToggleGroup
            type="single"
            size="sm"
            value={filtro}
            onValueChange={(v) => v && setFiltro(v as 'todas' | 'nao_lidos')}
            className="justify-start"
          >
            <ToggleGroupItem value="todas" className="h-7 px-2 text-xs">Todas</ToggleGroupItem>
            <ToggleGroupItem value="nao_lidos" className="h-7 px-2 text-xs gap-1">
              Não lidos
              {totalNaoLidos > 0 && (
                <Badge variant="secondary" className="ml-1 h-4 px-1 text-[9px]">
                  {totalNaoLidos}
                </Badge>
              )}
            </ToggleGroupItem>
          </ToggleGroup>
          {totalNaoLidos > 0 && onMarcarTodasLidas && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onMarcarTodasLidas}
              className="h-7 px-2 text-[11px] text-muted-foreground hover:text-foreground"
              title="Marcar todas as conversas como lidas"
            >
              <CheckCheck className="h-3.5 w-3.5 mr-1" />
              Marcar lidas
            </Button>
          )}
        </div>
      </div>

      {/* List */}
      <ScrollArea className="flex-1">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : conversasFiltradas.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <MessageSquare className="h-6 w-6 mb-2 opacity-50" />
            <p className="text-xs">
              {busca
                ? 'Nenhuma conversa encontrada'
                : filtro === 'nao_lidos'
                ? 'Nenhuma conversa não lida'
                : 'Nenhuma conversa'}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {conversasFiltradas.map((conversa) => {
              const isCobranca = !!conversa.ultima_cobranca;
              const isUnread = conversa.unread_count > 0;
              const isTransbordo = !!conversa.transbordo;
              const transbordoLabel = conversa.transbordo?.motivo === 'transbordo_boleto'
                ? 'Transbordo · Boleto'
                : 'Transbordo';
              const tempoCobranca = isCobranca
                ? formatDistanceToNowStrict(new Date(conversa.ultima_cobranca!), { locale: ptBR, addSuffix: false })
                : null;

              // Idade da última mensagem (em horas) — usado pra ramp de atenção em não lidos
              const ultimaMsgDate = new Date(conversa.ultima_mensagem);
              const horasDesdeUltima = (Date.now() - ultimaMsgDate.getTime()) / 3_600_000;
              const tempoRelativo = formatDistanceToNowStrict(ultimaMsgDate, { locale: ptBR, addSuffix: false });

              // Ramp de atenção (somente quando não lido e não-cobrança override)
              // <1h normal · 1-3h amber · 3-8h orange · >8h red + pulse
              let attentionBorder = '';
              let attentionBg = '';
              let attentionDot = '';
              let attentionPulse = false;
              if (isUnread && !isCobranca) {
                if (horasDesdeUltima >= 8) {
                  attentionBorder = 'border-l-red-500';
                  attentionBg = 'bg-red-50/60 dark:bg-red-950/30 hover:bg-red-100/60 dark:hover:bg-red-950/50';
                  attentionDot = 'bg-red-500';
                  attentionPulse = true;
                } else if (horasDesdeUltima >= 3) {
                  attentionBorder = 'border-l-orange-500';
                  attentionBg = 'bg-orange-50/50 dark:bg-orange-950/20 hover:bg-orange-100/50 dark:hover:bg-orange-950/40';
                  attentionDot = 'bg-orange-500';
                } else if (horasDesdeUltima >= 1) {
                  attentionBorder = 'border-l-amber-500';
                  attentionBg = 'bg-amber-50/40 dark:bg-amber-950/20 hover:bg-amber-100/40 dark:hover:bg-amber-950/30';
                  attentionDot = 'bg-amber-500';
                } else {
                  attentionBorder = 'border-l-emerald-500';
                  attentionDot = 'bg-emerald-500';
                }
              }

              return (
                <button
                  key={conversa.telefone}
                  onClick={() => onSelectConversa(conversa)}
                  title={
                    isCobranca
                      ? `Última cobrança enviada há ${tempoCobranca}`
                      : isUnread
                      ? `Última mensagem recebida há ${tempoRelativo} (${format(ultimaMsgDate, 'dd/MM HH:mm')})`
                      : undefined
                  }
                  className={cn(
                    'w-full flex items-start gap-3 px-3 py-3 text-left hover:bg-muted/50 transition-colors',
                    telefoneSelecionado === conversa.telefone && 'bg-muted',
                    isTransbordo && 'bg-red-50 dark:bg-red-950/30 border-l-4 border-l-red-500 hover:bg-red-100 dark:hover:bg-red-950/50',
                    !isTransbordo && isCobranca && 'bg-amber-50 dark:bg-amber-950/30 border-l-4 border-l-amber-500 hover:bg-amber-100 dark:hover:bg-amber-950/50',
                    !isTransbordo && !isCobranca && isUnread && cn('border-l-4', attentionBorder, attentionBg)
                  )}
                >
                  <div className="relative shrink-0">
                    <UserAvatar
                      src={conversa.avatar_url}
                      name={conversa.nome_contato}
                      size="md"
                    />
                    {isUnread && !isCobranca && attentionDot && (
                      <span
                        className={cn(
                          'absolute -top-0.5 -right-0.5 h-2.5 w-2.5 rounded-full ring-2 ring-background',
                          attentionDot,
                          attentionPulse && 'animate-pulse'
                        )}
                      />
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <span
                        className={cn(
                          'text-sm break-words leading-tight line-clamp-2',
                          isUnread ? 'font-bold text-foreground' : 'font-medium'
                        )}
                      >
                        {conversa.nome_contato || formatarTelefone(conversa.telefone)}
                      </span>
                      <div className="flex flex-col items-end gap-0.5 flex-shrink-0">
                        <span className={cn('text-[10px] whitespace-nowrap', isUnread ? 'text-emerald-600 dark:text-emerald-400 font-semibold' : 'text-muted-foreground')}>
                          {formatarData(conversa.ultima_mensagem)}
                        </span>
                        {isUnread && (
                          <Badge className="h-4 min-w-4 px-1 text-[9px] bg-emerald-600 hover:bg-emerald-600 rounded-full">
                            {conversa.unread_count > 99 ? '99+' : conversa.unread_count}
                          </Badge>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 mt-1">
                      {conversa.ultima_direcao === 'entrada' ? (
                        <User className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                      ) : (
                        <Bot className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                      )}
                      <p className={cn('text-xs truncate', isUnread ? 'text-foreground font-medium' : 'text-muted-foreground')}>
                        {conversa.ultima_msg_texto
                          ? conversa.ultima_msg_texto.slice(0, 50) + (conversa.ultima_msg_texto.length > 50 ? '...' : '')
                          : '📎 Mídia'}
                      </p>
                    </div>
                    <div className="flex items-center flex-wrap gap-x-2 gap-y-0.5 mt-1">
                      {conversa.nome_contato && (
                        <p className="text-[10px] text-muted-foreground">
                          {formatarTelefone(conversa.telefone)}
                        </p>
                      )}
                      {isUnread && (
                        <span
                          className={cn(
                            'text-[10px] font-medium flex items-center gap-1',
                            horasDesdeUltima >= 8
                              ? 'text-red-600 dark:text-red-400'
                              : horasDesdeUltima >= 3
                              ? 'text-orange-600 dark:text-orange-400'
                              : horasDesdeUltima >= 1
                              ? 'text-amber-700 dark:text-amber-400'
                              : 'text-emerald-600 dark:text-emerald-400'
                          )}
                        >
                          ⏱ há {tempoRelativo}
                        </span>
                      )}
                      {isTransbordo && (
                        <Badge
                          variant="outline"
                          className="text-[9px] py-0 px-1.5 h-4 border-red-500 text-red-700 dark:text-red-400 bg-red-100/60 dark:bg-red-950/50 gap-0.5 animate-pulse"
                        >
                          <AlertCircle className="h-2.5 w-2.5" />
                          {transbordoLabel}
                        </Badge>
                      )}
                      {isCobranca && (
                        <Badge
                          variant="outline"
                          className="text-[9px] py-0 px-1.5 h-4 border-amber-500 text-amber-700 dark:text-amber-400 bg-amber-100/50 dark:bg-amber-950/50 gap-0.5"
                        >
                          <AlertCircle className="h-2.5 w-2.5" />
                          Cobrança · {tempoCobranca}
                        </Badge>
                      )}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}
