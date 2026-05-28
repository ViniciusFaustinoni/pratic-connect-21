import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { CheckCircle2, Clock, AlertTriangle, Loader2, ShieldCheck, RefreshCw, ExternalLink } from 'lucide-react';
import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

/**
 * Sub-pílulas das 3 pontas (Monitoramento / SGA / Plataforma) + bloco de
 * pendência manual quando há item da fila `troca_titularidade:codigo_associado_nao_encontrado`.
 *
 * Lê direto da linha de `solicitacoes_troca_titularidade` (já hidratada via *)
 * e consulta `sga_sync_queue` apenas para detectar a pendência manual.
 */

type Ponta = 'monitoramento' | 'sga' | 'plataforma_rastreador';
type Estado = 'sincronizado' | 'pendente' | 'falha' | 'falha_permanente' | 'nao_aplicavel';

interface Props {
  solicitacao: {
    id: string;
    status: string;
    veiculo_id: string;
    veiculo?: { placa?: string | null } | null;
    aprovado_monitoramento_em?: string | null;
    sga_status?: string | null;
    plataforma_rastreador_status?: string | null;
    plataforma_rastreador_erro?: string | null;
  };
}

const COR: Record<Estado, string> = {
  sincronizado: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30',
  pendente: 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30',
  falha: 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30',
  falha_permanente: 'bg-destructive/15 text-destructive border-destructive/30',
  nao_aplicavel: 'bg-muted text-muted-foreground border-border',
};

function Pilula({ rotulo, estado, hint }: { rotulo: string; estado: Estado; hint?: string }) {
  const Icon = estado === 'sincronizado' ? CheckCircle2 : estado === 'falha_permanente' ? AlertTriangle : Clock;
  const badge = (
    <Badge variant="outline" className={cn('gap-1 text-xs font-medium', COR[estado])}>
      <Icon className="h-3 w-3" />
      {rotulo}: {estado === 'nao_aplicavel' ? 'não aplicável' : estado.replace('_', ' ')}
    </Badge>
  );
  if (!hint) return badge;
  return (
    <Tooltip>
      <TooltipTrigger asChild><span>{badge}</span></TooltipTrigger>
      <TooltipContent side="bottom" className="max-w-xs">{hint}</TooltipContent>
    </Tooltip>
  );
}

export function PontasPendentesCard({ solicitacao }: Props) {
  const qc = useQueryClient();
  const [resolvendo, setResolvendo] = useState(false);

  if (solicitacao.status !== 'efetivacao_pendente') return null;

  const estMonit: Estado = solicitacao.aprovado_monitoramento_em ? 'sincronizado' : 'pendente';
  const estSga: Estado = ((solicitacao.sga_status as Estado) ?? 'pendente') as Estado;
  const estPlat: Estado = ((solicitacao.plataforma_rastreador_status as Estado) ?? 'pendente') as Estado;

  // Detecta pendência manual SGA (codigo_associado_nao_encontrado)
  const { data: pendenciaManual } = useQuery({
    queryKey: ['troca-pendencia-manual', solicitacao.veiculo_id],
    enabled: !!solicitacao.veiculo_id,
    refetchInterval: 30_000,
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from('sga_sync_queue')
        .select('id, status, erro_ultimo, etapa_parou')
        .eq('veiculo_id', solicitacao.veiculo_id)
        .eq('origem', 'troca_titularidade')
        .eq('etapa_parou', 'troca_titularidade:codigo_associado_nao_encontrado')
        .neq('status', 'concluido')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      return data || null;
    },
  });

  const handleResolverManual = async () => {
    if (!pendenciaManual?.id) return;
    setResolvendo(true);
    try {
      const { data, error } = await supabase.functions.invoke('troca-resolver-pendencia-manual', {
        body: { queue_item_id: pendenciaManual.id },
      });
      if (error) throw error;
      if (data?.success) {
        toast.success('Pendência resolvida — gate de promoção foi reavaliado.');
        qc.invalidateQueries({ queryKey: ['troca-pendencia-manual', solicitacao.veiculo_id] });
        qc.invalidateQueries({ queryKey: ['solicitacao-troca', solicitacao.id] });
        qc.invalidateQueries({ queryKey: ['solicitacoes-troca'] });
      } else {
        toast.error(data?.error || 'Não foi possível resolver agora. Confirme no SGA e tente de novo.');
      }
    } catch (e: any) {
      toast.error(e?.message || 'Falha ao resolver pendência');
    } finally {
      setResolvendo(false);
    }
  };

  const handleRereavaliar = async () => {
    setResolvendo(true);
    try {
      await supabase.functions.invoke('troca-promover-com-sondagem', {
        body: { solicitacao_id: solicitacao.id },
      });
      toast.success('Gate reavaliado.');
      qc.invalidateQueries({ queryKey: ['solicitacao-troca', solicitacao.id] });
      qc.invalidateQueries({ queryKey: ['solicitacoes-troca'] });
    } catch (e: any) {
      toast.error(e?.message || 'Falha ao reavaliar');
    } finally {
      setResolvendo(false);
    }
  };

  const placa = (solicitacao.veiculo?.placa || '').toUpperCase();

  return (
    <Card className="border-amber-500/30 bg-amber-500/5">
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-amber-600" />
            <span className="font-semibold text-sm">Efetivação pendente — Regra das 3 pontas</span>
          </div>
          <Button size="sm" variant="ghost" onClick={handleRereavaliar} disabled={resolvendo}>
            <RefreshCw className={cn('h-3 w-3 mr-1', resolvendo && 'animate-spin')} />
            Reavaliar agora
          </Button>
        </div>

        <div className="flex flex-wrap gap-2">
          <Pilula rotulo="Monitoramento" estado={estMonit} />
          <Pilula rotulo="SGA" estado={estSga} />
          <Pilula
            rotulo="Plataforma rastreador"
            estado={estPlat}
            hint={solicitacao.plataforma_rastreador_erro || undefined}
          />
        </div>

        {pendenciaManual && (
          <Alert variant="destructive" className="border-destructive/40">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle className="text-sm">Pendência SGA — ação manual</AlertTitle>
            <AlertDescription className="text-xs space-y-2 mt-1">
              <p>
                O Hinova reporta CPF já cadastrado mas o /buscar volta 404. Preencha o{' '}
                <strong>código do associado</strong> diretamente no painel SGA Hinova e depois
                marque como resolvida — o sistema valida e libera a promoção.
              </p>
              {pendenciaManual.erro_ultimo && (
                <p className="text-[11px] opacity-75">Último erro: {pendenciaManual.erro_ultimo}</p>
              )}
              <div className="flex gap-2 flex-wrap pt-1">
                <Link
                  to={`/configuracoes/integracoes/sga-hinova?placa=${encodeURIComponent(placa)}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  <Button size="sm" variant="outline" type="button">
                    <ExternalLink className="h-3 w-3 mr-1" />
                    Abrir fila SGA
                  </Button>
                </Link>
                <Button
                  size="sm"
                  variant="default"
                  onClick={handleResolverManual}
                  disabled={resolvendo}
                  type="button"
                >
                  {resolvendo ? (
                    <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                  ) : (
                    <CheckCircle2 className="h-3 w-3 mr-1" />
                  )}
                  Marcar como resolvida
                </Button>
              </div>
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}
