import { Badge } from '@/components/ui/badge';
import { Link } from 'react-router-dom';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';

/**
 * Badge cruzado: lê sga_sync_queue pela placa e mostra status SGA na fila de Monitoramento.
 * Clique leva para /configuracoes/integracoes/sga-hinova?placa=XXX1234 com filtro pré-aplicado.
 *
 * Usa sga_status (da própria solicitacoes_troca_titularidade) como sinal primário.
 * Se a tabela já marcou pendente, busca ranking real na sga_sync_queue para distinguir
 * "aguardando" de "falha permanente".
 */
export function SgaSyncCrossBadge({
  placa,
  sgaStatus,
  className,
}: {
  placa?: string | null;
  sgaStatus?: string | null;
  className?: string;
}) {
  const placaUpper = (placa || '').trim().toUpperCase();
  const isSyncing = sgaStatus === 'pendente' || sgaStatus === 'falha';

  const { data: queueItem } = useQuery({
    queryKey: ['sga-cross-badge', placaUpper],
    enabled: !!placaUpper && isSyncing,
    refetchInterval: 60_000,
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from('sga_sync_queue')
        .select('id, status, tentativas, erro_ultimo, veiculos!sga_sync_queue_veiculo_id_fkey(placa)')
        .order('created_at', { ascending: false })
        .limit(20);
      const match = (data || []).find((q: any) =>
        (q.veiculos?.placa || '').toUpperCase() === placaUpper,
      );
      return match || null;
    },
  });

  if (!isSyncing && !queueItem) return null;
  if (sgaStatus === 'sincronizado') return null;

  const isPermanent = queueItem?.status === 'falha_permanente';
  const label = isPermanent
    ? 'Falha permanente SGA — resolver'
    : 'Aguardando sincronização SGA';
  const Icon = isPermanent ? AlertTriangle : RefreshCw;

  return (
    <Link
      to={`/configuracoes/integracoes/sga-hinova?placa=${encodeURIComponent(placaUpper)}`}
      onClick={(e) => e.stopPropagation()}
      className="inline-flex"
      title={queueItem?.erro_ultimo || 'Clique para abrir a fila SGA filtrada por esta placa'}
    >
      <Badge
        variant="outline"
        className={cn(
          'text-xs gap-1 hover:underline cursor-pointer',
          isPermanent
            ? 'border-destructive/40 text-destructive bg-destructive/10'
            : 'border-amber-500/40 text-amber-700 bg-amber-500/10 dark:text-amber-400',
          className,
        )}
      >
        <Icon className={cn('h-3 w-3', !isPermanent && 'animate-spin-slow')} />
        {label}
      </Badge>
    </Link>
  );
}
