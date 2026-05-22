import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Inbox, X, Clock, AlertTriangle, ExternalLink, MessageCircle } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { UserAvatar } from '@/components/UserAvatar';
import { cn } from '@/lib/utils';
import {
  useCotacoesLinkPublicoIncompleto,
  type CotacaoLinkIncompleto,
} from '@/hooks/useCotacoesLinkPublicoIncompleto';
import { descreverEtapaPendente, type CodigoEtapaPendente, CODIGOS_PENDENCIA_ASSOCIADO } from '@/lib/etapaPendentePublica';

function horasNaFila(dataIso: string | null): number {
  if (!dataIso) return 0;
  return (Date.now() - new Date(dataIso).getTime()) / (1000 * 60 * 60);
}

function corDeSla(dataIso: string | null) {
  const h = horasNaFila(dataIso);
  if (h > 48) return { border: 'border-l-destructive', text: 'text-destructive' };
  if (h > 24) return { border: 'border-l-warning', text: 'text-warning' };
  return { border: 'border-l-success', text: 'text-success' };
}

const FILTROS_ETAPA: { value: 'todos' | CodigoEtapaPendente; label: string }[] = [
  { value: 'todos', label: 'Todas as etapas' },
  { value: 'aguardando_escolha_plano', label: 'Aguardando escolha do plano' },
  { value: 'aguardando_documentos', label: 'Aguardando documentos' },
  { value: 'aguardando_assinatura_contrato', label: 'Aguardando assinatura' },
  { value: 'aguardando_pagamento_adesao', label: 'Aguardando pagamento' },
  { value: 'aguardando_escolha_vistoria', label: 'Aguardando escolha de vistoria' },
  { value: 'aguardando_autovistoria', label: 'Aguardando autovistoria' },
  { value: 'aguardando_agendamento_instalacao', label: 'Aguardando agendamento' },
];

/**
 * Aba "Link Público Incompleto" — Cadastro vê cotações onde o associado
 * ainda não cumpriu a etapa que faria o caso entrar na fila normal de análise.
 * Mesmo vocabulário e padrão visual da tela de Propostas Pendentes.
 */
export function LinkPublicoIncompletoTab() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [etapaFilter, setEtapaFilter] = useState<'todos' | CodigoEtapaPendente>('todos');

  const { data, isLoading } = useCotacoesLinkPublicoIncompleto();

  const lista = useMemo(() => {
    const itens: CotacaoLinkIncompleto[] = data ?? [];
    const searchLower = search.trim().toLowerCase();
    const searchDigits = search.replace(/\D/g, '');
    return itens
      .filter((item) => {
        const c = item.cotacao;
        const lead = c.leads as any;
        const matchSearch =
          !searchLower ||
          (c.nome_solicitante || '').toLowerCase().includes(searchLower) ||
          (lead?.nome || '').toLowerCase().includes(searchLower) ||
          (c.veiculo_placa || '').toLowerCase().includes(searchLower) ||
          (c.veiculo_modelo || '').toLowerCase().includes(searchLower) ||
          (c.veiculo_marca || '').toLowerCase().includes(searchLower) ||
          (c.numero || '').toLowerCase().includes(searchLower) ||
          (searchDigits && (c.telefone1_solicitante || '').replace(/\D/g, '').includes(searchDigits));
        if (!matchSearch) return false;
        if (etapaFilter !== 'todos' && item.etapa.codigo !== etapaFilter) return false;
        return true;
      })
      .sort((a, b) => {
        // mais antiga primeiro (cobrar antes)
        const ta = new Date(a.ultimaAtualizacao ?? 0).getTime();
        const tb = new Date(b.ultimaAtualizacao ?? 0).getTime();
        return ta - tb;
      });
  }, [data, search, etapaFilter]);

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-warning/30 bg-warning/5 p-3 flex gap-3 items-start">
        <AlertTriangle className="h-4 w-4 text-warning flex-shrink-0 mt-0.5" />
        <div className="text-xs text-foreground">
          <p className="font-semibold">Essas cotações ainda não chegaram na fila normal de análise</p>
          <p className="text-muted-foreground mt-0.5">
            O associado entrou no link público mas parou em alguma etapa. O caso não é bug — falta o cliente completar.
            Cobre o consultor responsável ou entre em contato direto pelo telefone do associado.
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome, placa, telefone, modelo, nº da cotação…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10 bg-card border-border h-10 text-sm rounded-xl"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted"
              aria-label="Limpar busca"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
        <Select value={etapaFilter} onValueChange={(v) => setEtapaFilter(v as any)}>
          <SelectTrigger className="h-10 w-full sm:w-[260px] rounded-xl text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {FILTROS_ETAPA.map((o) => (
              <SelectItem key={o.value} value={o.value} className="text-xs">
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {data && (
        <div className="text-xs text-muted-foreground">
          {lista.length} cotação(ões) com link público parado
          {lista.length > 0 && ' — ordenado da mais antiga para a mais recente'}
        </div>
      )}

      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-20 w-full bg-muted rounded-xl" />)}
        </div>
      ) : lista.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <div className="w-16 h-16 rounded-full bg-muted/50 flex items-center justify-center mx-auto mb-4">
            <Inbox className="h-8 w-8 text-muted-foreground/40" />
          </div>
          <p className="font-semibold text-foreground text-base">Nada parado no link público</p>
          <p className="text-sm mt-1">Todas as cotações em andamento avançaram para a próxima etapa.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {lista.map((item) => {
            const c = item.cotacao;
            const lead = c.leads as any;
            const vendedor = (c as any).vendedor as { nome?: string | null } | null;
            const sla = corDeSla(item.ultimaAtualizacao);
            const nome = c.nome_solicitante || lead?.nome || '---';
            const telefone = c.telefone1_solicitante || lead?.telefone || '';
            const veiculo = [c.veiculo_marca, c.veiculo_modelo].filter(Boolean).join(' ') || c.veiculo_modelo || '---';
            return (
              <div
                key={c.id}
                className={cn(
                  'group p-3 sm:p-3.5 rounded-xl bg-card border border-border transition-all cursor-pointer border-l-4',
                  'hover:bg-accent/30 hover:shadow-sm',
                  sla.border,
                )}
                onClick={() => navigate(`/vendas/cotacoes/${c.id}`)}
              >
                <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                  <UserAvatar name={nome} size="sm" className="flex-shrink-0" />
                  <div className="flex-shrink-0">
                    <span className="font-mono text-[11px] sm:text-xs font-bold text-foreground bg-muted px-1.5 sm:px-2 py-1 rounded-md">
                      {c.veiculo_placa || '---'}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{nome}</p>
                    <p className="text-xs text-muted-foreground truncate">{veiculo}</p>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    {telefone && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0"
                        onClick={(e) => {
                          e.stopPropagation();
                          const digits = telefone.replace(/\D/g, '');
                          window.open(`https://wa.me/55${digits}`, '_blank');
                        }}
                        aria-label="Abrir WhatsApp"
                      >
                        <MessageCircle className="h-3.5 w-3.5" />
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0"
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate(`/vendas/cotacoes/${c.id}`);
                      }}
                      aria-label="Abrir cotação"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>

                <div className="mt-2 flex flex-wrap items-center gap-1.5 pl-0 sm:pl-11">
                  <Badge className="bg-warning/15 text-warning border-warning/30 text-[10px] px-1.5">
                    <Clock className="h-2.5 w-2.5 mr-1" />
                    {item.etapa.label}
                  </Badge>
                  {vendedor?.nome && (
                    <Badge variant="secondary" className="text-[9px] px-1.5 py-0 h-5 max-w-[40%] truncate">
                      Consultor: {vendedor.nome}
                    </Badge>
                  )}
                  <span className={cn('ml-auto text-[10px] font-semibold tabular-nums', sla.text)}>
                    {item.ultimaAtualizacao
                      ? formatDistanceToNow(new Date(item.ultimaAtualizacao), { locale: ptBR, addSuffix: false })
                      : '---'}
                  </span>
                </div>

                {item.etapa.descricaoAssociado && (
                  <p className="mt-1.5 text-[11px] text-muted-foreground pl-0 sm:pl-11">
                    {item.etapa.descricaoAssociado}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// Re-export do conjunto canônico para conveniência de consumers
export { CODIGOS_PENDENCIA_ASSOCIADO };
