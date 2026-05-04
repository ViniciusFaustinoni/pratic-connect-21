import { useQuery } from '@tanstack/react-query';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { supabase } from '@/integrations/supabase/client';
import { ArrowRightLeft, AlertTriangle, CheckCircle2, Clock, Ban } from 'lucide-react';
import { cn } from '@/lib/utils';

interface TrocaTitularidadeBadgeProps {
  cotacaoId: string;
  tipoEntrada?: string | null;
}

interface TrocaInfo {
  id: string;
  status: string;
  termo_cancelamento_url: string | null;
  termo_cancelamento_assinado_em: string | null;
  associado_antigo_id: string | null;
}

interface DebitoPendente {
  id: string;
  status: string;
  valor_total: number;
}

export function useTrocaTitularidadePorCotacao(
  cotacaoId: string | undefined,
  enabled: boolean,
) {
  return useQuery({
    queryKey: ['troca-titularidade-por-cotacao', cotacaoId],
    enabled: !!cotacaoId && enabled,
    staleTime: 30_000,
    queryFn: async () => {
      const { data: troca } = await (supabase as any)
        .from('solicitacoes_troca_titularidade')
        .select(
          'id, status, termo_cancelamento_url, termo_cancelamento_assinado_em, associado_antigo_id',
        )
        .eq('cotacao_id', cotacaoId)
        .maybeSingle();
      if (!troca) return null;
      const { data: debitos } = await (supabase as any)
        .from('relacionamento_debitos_pendentes')
        .select('id, status, valor_total')
        .eq('solicitacao_troca_id', troca.id);
      return {
        troca: troca as TrocaInfo,
        debitos: (debitos || []) as DebitoPendente[],
      };
    },
  });
}

const STATUS_LABELS: Record<string, { label: string; tone: 'info' | 'warn' | 'ok' | 'danger' }> = {
  cotacao_em_andamento: { label: 'Troca: termo pendente', tone: 'warn' },
  aguardando_cadastro: { label: 'Troca: aguardando cadastro', tone: 'info' },
  aguardando_monitoramento: { label: 'Troca: aguardando monitoramento', tone: 'info' },
  aguardando_vistoria: { label: 'Troca: aguardando vistoria', tone: 'info' },
  liberada_para_assinatura: { label: 'Troca: liberada p/ assinatura', tone: 'ok' },
  efetivada: { label: 'Troca efetivada', tone: 'ok' },
  reprovada_cadastro: { label: 'Troca reprovada', tone: 'danger' },
  reprovada_monitoramento: { label: 'Troca reprovada', tone: 'danger' },
  cancelada: { label: 'Troca cancelada', tone: 'danger' },
};

const TONE_CLASS: Record<string, string> = {
  info: 'bg-blue-500/15 text-blue-700 dark:text-blue-300 border-0',
  warn: 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-0',
  ok: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-0',
  danger: 'bg-red-500/15 text-red-700 dark:text-red-300 border-0',
};

export function TrocaTitularidadeBadge({ cotacaoId, tipoEntrada }: TrocaTitularidadeBadgeProps) {
  const isTroca = tipoEntrada === 'troca_titularidade';
  const { data } = useTrocaTitularidadePorCotacao(cotacaoId, isTroca);
  if (!isTroca || !data?.troca) return null;

  const { troca, debitos } = data;
  const debitosAbertos = debitos.filter((d) => d.status === 'aberto');
  const totalDebitos = debitosAbertos.reduce((a, d) => a + Number(d.valor_total || 0), 0);
  const cfg = STATUS_LABELS[troca.status] ?? { label: 'Troca em andamento', tone: 'info' as const };
  const Icon =
    cfg.tone === 'ok'
      ? CheckCircle2
      : cfg.tone === 'danger'
        ? Ban
        : cfg.tone === 'warn'
          ? Clock
          : ArrowRightLeft;

  return (
    <div className="flex flex-col gap-1 w-fit">
      <Badge className={cn(TONE_CLASS[cfg.tone], 'text-[10px] px-2 py-0.5 rounded-full')}>
        <Icon className="h-2.5 w-2.5 mr-1" />
        {cfg.label}
      </Badge>
      {debitosAbertos.length > 0 && (
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge className="bg-red-500/15 text-red-700 dark:text-red-300 border-0 text-[10px] px-2 py-0.5 rounded-full cursor-help">
              <AlertTriangle className="h-2.5 w-2.5 mr-1" />
              Associado com pendência
            </Badge>
          </TooltipTrigger>
          <TooltipContent side="right">
            {debitosAbertos.length} boleto(s) em aberto · R${' '}
            {totalDebitos.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </TooltipContent>
        </Tooltip>
      )}
      {troca.status === 'aguardando_cadastro' && !debitosAbertos.length && (
        <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-0 text-[10px] px-2 py-0.5 rounded-full">
          <CheckCircle2 className="h-2.5 w-2.5 mr-1" />
          Placa liberada
        </Badge>
      )}
    </div>
  );
}
