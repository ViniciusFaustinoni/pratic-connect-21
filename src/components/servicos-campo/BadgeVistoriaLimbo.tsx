import { useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, RotateCw } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useState } from 'react';

/**
 * Anti-limbo da vistoria interna do Monitoramento/Instalador.
 *
 * Detecta o caso reportado em 10/06/26 (operador KAIKE) — o executor da
 * vistoria mostra "Todas as fotos foram enviadas!" mas o servidor não tem
 * nenhuma `vistoria_fotos` ligada à vistoria que a tela carrega. Ao sair e
 * voltar, tudo some.
 *
 * Critério: serviço de campo VIVO (instalacao/vistoria_entrada/revistoria),
 * com indício de execução iniciada (etapa_atual>1 OU checklist_data com
 * algo) e que NÃO tem vistoria materializada com fotos+vídeo coerentes.
 *
 * Ação: "Reconciliar mídias" reexecuta a RPC canônica
 * `fn_obter_ou_criar_vistoria_servico` (advisory lock por serviço) e invalida
 * as queries para a UI puxar a verdade do servidor.
 *
 * Ver mem://logic/operations/vistoria-interna-anti-limbo-fotos-video.
 */
interface Props {
  servicoId: string;
  tipo: string;
  status: string;
}

const TIPOS_ELEGIVEIS = new Set(['instalacao', 'vistoria_entrada', 'revistoria']);
const STATUS_TERMINAIS = new Set([
  'concluida', 'aprovada', 'aprovada_ressalvas', 'reprovada', 'cancelada',
]);

export function BadgeVistoriaLimbo({ servicoId, tipo, status }: Props) {
  const queryClient = useQueryClient();
  const [reconciling, setReconciling] = useState(false);

  const elegivel = TIPOS_ELEGIVEIS.has(tipo) && !STATUS_TERMINAIS.has(status);

  const { data: limbo } = useQuery({
    queryKey: ['vistoria-limbo', servicoId],
    enabled: elegivel,
    staleTime: 30_000,
    refetchInterval: 60_000,
    queryFn: async () => {
      // 1) progresso UI no serviço
      const { data: servico, error: sErr } = await supabase
        .from('servicos')
        .select('etapa_atual, checklist_data, vistoria_origem_id')
        .eq('id', servicoId)
        .maybeSingle();
      if (sErr || !servico) return null;

      const checklistTemAlgo =
        servico.checklist_data && typeof servico.checklist_data === 'object'
          && Object.keys(servico.checklist_data as Record<string, unknown>).length > 0;
      const etapaAvancou = (servico.etapa_atual ?? 1) > 1;
      if (!checklistTemAlgo && !etapaAvancou) return null;

      // 2) sem vistoria materializada
      if (!servico.vistoria_origem_id) {
        return { motivo: 'sem_vistoria' as const };
      }

      // 3) vistoria existe mas vazia (0 fotos + sem vídeo)
      const [{ count: fotosCount }, { data: vist }] = await Promise.all([
        supabase
          .from('vistoria_fotos')
          .select('id', { count: 'exact', head: true })
          .eq('vistoria_id', servico.vistoria_origem_id),
        supabase
          .from('vistorias')
          .select('video_360_url')
          .eq('id', servico.vistoria_origem_id)
          .maybeSingle(),
      ]);

      if ((fotosCount ?? 0) === 0 && !vist?.video_360_url) {
        return { motivo: 'vistoria_vazia' as const };
      }
      return null;
    },
  });

  if (!elegivel || !limbo) return null;

  const handleReconciliar = async () => {
    setReconciling(true);
    try {
      const { error } = await (supabase as any).rpc(
        'fn_obter_ou_criar_vistoria_servico',
        { p_servico_id: servicoId },
      );
      if (error) throw error;
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['vistoria-completa-servico'] }),
        queryClient.invalidateQueries({ queryKey: ['vistoria-completa'] }),
        queryClient.invalidateQueries({ queryKey: ['vistorias'] }),
        queryClient.invalidateQueries({ queryKey: ['servicos'] }),
        queryClient.invalidateQueries({ queryKey: ['vistoria-limbo', servicoId] }),
      ]);
      toast.success('Vistoria reconciliada — recarregue o executor para conferir.');
    } catch (e: any) {
      toast.error(`Falha ao reconciliar: ${e?.message || 'erro desconhecido'}`);
    } finally {
      setReconciling(false);
    }
  };

  const titulo =
    limbo.motivo === 'sem_vistoria'
      ? 'Vistoria não materializada'
      : 'Mídias divergentes';
  const descricao =
    limbo.motivo === 'sem_vistoria'
      ? 'O executor começou a vistoria mas o serviço ainda não tem vistoria vinculada.'
      : 'O executor avançou no checklist, mas a vistoria atual está sem fotos e sem vídeo no servidor.';

  return (
    <div className="flex items-center gap-2 rounded-md border border-amber-500/60 bg-amber-950/30 px-3 py-2 text-sm">
      <AlertTriangle className="h-4 w-4 text-amber-400 shrink-0" />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant="outline" className="border-amber-500/60 text-amber-300">
            {titulo}
          </Badge>
        </div>
        <p className="text-xs text-amber-200/80 mt-0.5">{descricao}</p>
      </div>
      <Button
        size="sm"
        variant="outline"
        onClick={handleReconciliar}
        disabled={reconciling}
        className="gap-1.5"
      >
        <RotateCw className={reconciling ? 'h-3.5 w-3.5 animate-spin' : 'h-3.5 w-3.5'} />
        Reconciliar mídias
      </Button>
    </div>
  );
}
