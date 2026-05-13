import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export interface SolicitarVistoriaTecnicoParams {
  servicoId: string;       // serviço atual em análise no monitoramento
  veiculoId: string;
  associadoId: string;
  motivo: string;
  cenario: 'rota' | 'base'; // onde a vistoria sem instalação será feita
  dataAgendada?: string;    // YYYY-MM-DD (Rota)
  periodo?: 'manha' | 'tarde'; // Rota/Base
  fotosObrigatorias: number; // 31 carro / 15 moto
}

/**
 * Sub-FIPE (sem rastreador): após autovistoria pelo associado, monitoramento
 * pode pedir nova vistoria presencial executada por técnico — SEM instalação,
 * apenas refazendo o roteiro de fotos completo (31/15).
 *
 * Cria um novo serviço `vistoria_entrada` agendado, marca o serviço atual como
 * "aprovada" (sai da fila) com observação de ressalva e registra histórico.
 */
export function useSolicitarVistoriaTecnico() {
  const queryClient = useQueryClient();
  const { profile } = useAuth();

  return useMutation({
    mutationFn: async (data: SolicitarVistoriaTecnicoParams) => {
      const { data: resp, error } = await supabase.functions.invoke(
        'solicitar-vistoria-tecnico-sub-fipe',
        {
          body: {
            servicoId: data.servicoId,
            veiculoId: data.veiculoId,
            associadoId: data.associadoId,
            motivo: data.motivo,
            cenario: data.cenario,
            dataAgendada: data.dataAgendada ?? null,
            periodo: data.periodo ?? null,
            fotosObrigatorias: data.fotosObrigatorias,
            solicitadoPor: profile?.id ?? null,
          },
        },
      );
      if (error) throw error;
      if (!(resp as any)?.success) throw new Error((resp as any)?.error || 'Falha ao solicitar vistoria');
      return {
        servicoId: (resp as any).servicoId as string,
        linkUrl: (resp as any).linkUrl as string | null,
      };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['instalacoes-aguardando-aprovacao-monitoramento'] });
      queryClient.invalidateQueries({ queryKey: ['aprovacao-monitoramento-stats'] });
      queryClient.invalidateQueries({ queryKey: ['servicos'] });
      queryClient.invalidateQueries({ queryKey: ['servicos-campo'] });
      toast.success('Vistoria de técnico solicitada — serviço de campo criado.');
    },
    onError: (err: any) => {
      console.error('[solicitar-vistoria-tecnico] erro:', err);
      toast.error(err?.message || 'Não foi possível solicitar a vistoria de técnico.');
    },
  });
}

/**
 * Veículo dispensa rastreador? (mesma regra de exigeRastreador).
 */
export function veiculoSubFipe(veiculo: { valor_fipe?: number | null; combustivel?: string | null; categoria?: string | null }) {
  if (!veiculo) return false;
  if ((veiculo.combustivel || '').toLowerCase() === 'diesel') return false;
  const cat = (veiculo.categoria || '').toLowerCase();
  const isMoto = cat.includes('moto') || cat.includes('ciclomotor');
  const fipe = Number(veiculo.valor_fipe || 0);
  if (isMoto) return fipe > 0 && fipe < 9000;
  return fipe > 0 && fipe < 30000;
}
