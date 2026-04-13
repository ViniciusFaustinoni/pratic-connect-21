import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useConfigDuplaAprovacao } from './useAprovacoesFipeDiretoria';

export interface AprovacaoDiretoria {
  id: string;
  cotacao_id: string;
  diretor_id: string;
  status: string;
  telefone: string | null;
  respondido_em: string | null;
  created_at: string | null;
  cotacao?: {
    numero?: string;
    nome_solicitante?: string;
    veiculo_marca?: string;
    veiculo_modelo?: string;
    veiculo_ano?: string;
    veiculo_placa?: string;
    valor_fipe?: number;
    categoria_placa?: string;
    cpf_solicitante?: string;
    telefone_solicitante?: string;
  };
  diretor?: {
    nome?: string;
  };
  // Contagem de votos da cotação
  total_aprovados?: number;
  total_votos?: number;
}

export function useAprovacoesDiretoria(statusFilter?: string) {
  return useQuery({
    queryKey: ['aprovacoes-diretoria', statusFilter],
    queryFn: async () => {
      let query = (supabase as any)
        .from('aprovacoes_fipe_diretoria')
        .select(`
          id, cotacao_id, diretor_id, status, telefone, respondido_em, created_at,
          cotacao:cotacoes(numero, nome_solicitante, veiculo_marca, veiculo_modelo, veiculo_ano, veiculo_placa, valor_fipe, categoria_placa, cpf_solicitante, telefone_solicitante),
          diretor:profiles!aprovacoes_fipe_diretoria_diretor_id_fkey(nome)
        `)
        .order('created_at', { ascending: false });

      if (statusFilter) {
        query = query.eq('status', statusFilter);
      }

      const { data, error } = await query;
      if (error) throw error;

      // Agrupar por cotacao_id para contar votos
      const votosPorCotacao: Record<string, { aprovados: number; total: number }> = {};
      
      // Buscar todos os votos para as cotações retornadas
      const cotacaoIds = [...new Set((data || []).map((d: any) => d.cotacao_id))];
      if (cotacaoIds.length > 0) {
        const { data: todosVotos } = await (supabase as any)
          .from('aprovacoes_fipe_diretoria')
          .select('cotacao_id, status')
          .in('cotacao_id', cotacaoIds);

        for (const v of todosVotos || []) {
          if (!votosPorCotacao[v.cotacao_id]) {
            votosPorCotacao[v.cotacao_id] = { aprovados: 0, total: 0 };
          }
          votosPorCotacao[v.cotacao_id].total++;
          if (v.status === 'aprovado') {
            votosPorCotacao[v.cotacao_id].aprovados++;
          }
        }
      }

      return (data || []).map((item: any) => ({
        ...item,
        cotacao: item.cotacao || {},
        diretor: item.diretor || {},
        total_aprovados: votosPorCotacao[item.cotacao_id]?.aprovados || 0,
        total_votos: votosPorCotacao[item.cotacao_id]?.total || 0,
      })) as AprovacaoDiretoria[];
    },
  });
}

export function useVotarAprovacaoDiretoria() {
  const queryClient = useQueryClient();
  const { data: config } = useConfigDuplaAprovacao();

  return useMutation({
    mutationFn: async ({ id, cotacao_id, voto }: { id: string; cotacao_id: string; voto: 'aprovado' | 'recusado' }) => {
      // 1. Atualizar o voto individual
      const { error } = await (supabase as any)
        .from('aprovacoes_fipe_diretoria')
        .update({ status: voto, respondido_em: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;

      // 2. Contar aprovações da cotação
      const { data: votos } = await (supabase as any)
        .from('aprovacoes_fipe_diretoria')
        .select('status')
        .eq('cotacao_id', cotacao_id);

      const aprovados = (votos || []).filter((v: any) => v.status === 'aprovado').length;
      const minimoVotos = config?.minimoVotos || 2;

      // 3. Se atingiu mínimo, aprovar a cotação
      if (aprovados >= minimoVotos) {
        await (supabase as any)
          .from('cotacoes')
          .update({ fipe_diretoria_aprovado: true })
          .eq('id', cotacao_id);
      }

      // 4. Se todos recusaram, marcar como recusado
      const todosResponderam = (votos || []).every((v: any) => v.status !== 'pendente');
      if (todosResponderam && aprovados < minimoVotos) {
        await (supabase as any)
          .from('cotacoes')
          .update({ fipe_diretoria_aprovado: null })
          .eq('id', cotacao_id);
      }

      return { aprovados, minimoVotos };
    },
    onSuccess: (result, variables) => {
      const label = variables.voto === 'aprovado' ? 'Voto de aprovação registrado' : 'Voto de recusa registrado';
      toast.success(label);
      queryClient.invalidateQueries({ queryKey: ['aprovacoes-diretoria'] });
      queryClient.invalidateQueries({ queryKey: ['aprovacao-fipe-diretoria'] });
    },
    onError: (err: any) => {
      toast.error('Erro ao registrar voto: ' + err.message);
    },
  });
}
