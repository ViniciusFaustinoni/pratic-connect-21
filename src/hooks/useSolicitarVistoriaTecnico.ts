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
      const agora = new Date().toISOString();

      // 1) Tira o serviço atual da fila do monitoramento sem ativar Proteção 360.
      //    `aprovada` (text) basta — fila filtra por status='concluida'.
      const ressalva = `Monitoramento solicitou nova vistoria presencial (sem instalação). Motivo: ${data.motivo}`;
      const { error: updErr } = await supabase
        .from('servicos')
        .update({
          status: 'aprovada' as any,
          analisado_em: agora,
          analisado_por: profile?.id ?? null,
          observacoes_analise: ressalva,
          ressalvas: 'vistoria_sem_instalacao_solicitada',
          updated_at: agora,
        } as any)
        .eq('id', data.servicoId);
      if (updErr) throw updErr;

      // 2) Buscar contrato/cotação para herdar contexto.
      const { data: srvAtual } = await (supabase as any)
        .from('servicos')
        .select('contrato_id, cotacao_id, cep, logradouro, numero, complemento, bairro, cidade, uf')
        .eq('id', data.servicoId)
        .maybeSingle();

      // 3) Cria novo serviço de vistoria sem instalação.
      const tag = `[VISTORIA_SEM_INSTALACAO]${JSON.stringify({
        motivo: data.motivo,
        fotos_obrigatorias: data.fotosObrigatorias,
        cenario: data.cenario,
        origem_servico_id: data.servicoId,
      })}`;
      const novo: any = {
        tipo: 'vistoria_entrada',
        status: 'agendada',
        veiculo_id: data.veiculoId,
        associado_id: data.associadoId,
        contrato_id: srvAtual?.contrato_id ?? null,
        cotacao_id: srvAtual?.cotacao_id ?? null,
        data_agendada: data.dataAgendada ?? null,
        periodo: data.periodo ?? null,
        modalidade: data.cenario,
        cep: data.cenario === 'rota' ? srvAtual?.cep ?? null : null,
        logradouro: data.cenario === 'rota' ? srvAtual?.logradouro ?? null : null,
        numero: data.cenario === 'rota' ? srvAtual?.numero ?? null : null,
        complemento: data.cenario === 'rota' ? srvAtual?.complemento ?? null : null,
        bairro: data.cenario === 'rota' ? srvAtual?.bairro ?? null : null,
        cidade: data.cenario === 'rota' ? srvAtual?.cidade ?? null : null,
        uf: data.cenario === 'rota' ? srvAtual?.uf ?? null : null,
        observacoes: `${tag}\n${ressalva}`,
        origem: 'monitoramento_sub_fipe',
      };
      const { data: srvNovo, error: insErr } = await (supabase as any)
        .from('servicos')
        .insert(novo)
        .select('id')
        .single();
      if (insErr) throw insErr;

      // 4) Histórico no associado.
      await (supabase as any).from('associados_historico').insert({
        associado_id: data.associadoId,
        tipo: 'vistoria_tecnico_solicitada_monitoramento',
        descricao: `Monitoramento solicitou vistoria presencial (sem instalação) — ${data.motivo}`,
        dados_novos: {
          servico_origem_id: data.servicoId,
          servico_novo_id: srvNovo?.id,
          veiculo_id: data.veiculoId,
          cenario: data.cenario,
          fotos_obrigatorias: data.fotosObrigatorias,
        },
        usuario_id: profile?.id ?? null,
      });

      return { servicoId: srvNovo?.id as string };
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
