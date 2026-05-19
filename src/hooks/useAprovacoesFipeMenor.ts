import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface AprovacaoFipeMenor {
  id: string;
  cotacao_id: string;
  solicitante_id: string;
  supervisor_id: string | null;
  fipe_real: number;
  fipe_faixa_original_min: number;
  fipe_faixa_original_max: number;
  fipe_faixa_solicitada_min: number;
  fipe_faixa_solicitada_max: number;
  valor_mensal_original: number;
  valor_mensal_reduzido: number;
  justificativa: string | null;
  // Novo fluxo: 'ciente_pendente' aguardando supervisor marcar como visto; 'ciente' marcado.
  // Valores legados ('pendente'/'aprovado'/'recusado') foram migrados para 'ciente'.
  status: 'ciente_pendente' | 'ciente' | 'pendente' | 'aprovado' | 'recusado';
  observacao_supervisor: string | null;
  respondido_em: string | null;
  created_at: string;
  updated_at: string;
  cotacao?: {
    id: string;
    numero: string;
    valor_fipe: number;
    veiculo_marca: string | null;
    veiculo_modelo: string | null;
    veiculo_ano: number | null;
    veiculo_placa: string | null;
    nome_solicitante: string | null;
    telefone1_solicitante: string | null;
    status: string;
  } | null;
  solicitante?: {
    nome: string;
    email: string;
  } | null;
}

/**
 * Lista solicitações de Redução de Cota (Regra do 1%).
 * statusFilter aceita 'ciente_pendente' (não vistos) ou 'ciente' (já marcados);
 * sem filtro retorna tudo.
 */
export function useAprovacoesFipeMenor(statusFilter?: string) {
  return useQuery({
    queryKey: ['aprovacoes-fipe-menor', statusFilter],
    queryFn: async () => {
      let query = supabase
        .from('aprovacoes_fipe_menor')
        .select(`
          *,
          cotacao:cotacoes!cotacao_id(
            id, numero, valor_fipe, veiculo_marca, veiculo_modelo,
            veiculo_ano, veiculo_placa, nome_solicitante, telefone1_solicitante, status
          )
        `)
        .order('created_at', { ascending: false });

      if (statusFilter) {
        query = query.eq('status', statusFilter);
      }

      const { data, error } = await query;
      if (error) throw error;
      const rows = (data || []) as any[];

      const userIds = Array.from(new Set(rows.map((r) => r.solicitante_id).filter(Boolean)));
      const profilesMap = new Map<string, { nome: string; email: string }>();
      if (userIds.length) {
        const { data: profs } = await supabase
          .from('profiles')
          .select('user_id, nome, email')
          .in('user_id', userIds);
        for (const p of profs || []) {
          profilesMap.set(p.user_id, { nome: p.nome ?? '', email: p.email ?? '' });
        }
      }

      return rows.map((r) => ({
        ...r,
        solicitante: profilesMap.get(r.solicitante_id) ?? null,
      })) as AprovacaoFipeMenor[];
    },
  });
}

/**
 * Registra automaticamente a aplicação da Regra do 1% numa cotação.
 * Não pede aprovação — apenas alimenta a fila para o supervisor "tomar ciência".
 * A cotação já é gravada com fipe_menor_aprovado=true + faixa reduzida desde o salvamento.
 */
export function useRegistrarCienciaFipeMenor() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      cotacao_id: string;
      fipe_real: number;
      fipe_faixa_original_min: number;
      fipe_faixa_original_max: number;
      fipe_faixa_solicitada_min: number;
      fipe_faixa_solicitada_max: number;
      valor_mensal_original: number;
      valor_mensal_reduzido: number;
    }) => {
      const { data: currentUser } = await supabase.auth.getUser();

      const { error } = await supabase.from('aprovacoes_fipe_menor').insert({
        ...data,
        solicitante_id: currentUser.user?.id!,
        status: 'ciente_pendente',
        justificativa: null,
      });
      if (error) throw error;

      // Cotação já aplica a redução: marca aprovada + faixa de cobrança reduzida
      const { error: cotErr } = await supabase
        .from('cotacoes')
        .update({
          solicitar_fipe_menor: true,
          fipe_menor_aprovado: true,
          fipe_faixa_cobranca_min: data.fipe_faixa_solicitada_min,
          fipe_faixa_cobranca_max: data.fipe_faixa_solicitada_max,
        })
        .eq('id', data.cotacao_id);
      if (cotErr) throw cotErr;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['aprovacoes-fipe-menor'] });
      queryClient.invalidateQueries({ queryKey: ['cotacoes'] });
    },
    onError: (err) => {
      // Falha silenciosa — a cotação já foi salva; só não alimentou a fila.
      console.error('[fipe-menor] falha ao registrar ciência:', err);
    },
  });
}

/**
 * Supervisor marca como ciente (não bloqueia, não reverte preço).
 */
export function useMarcarCienteFipeMenor() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, observacao }: { id: string; observacao?: string }) => {
      const { data: currentUser } = await supabase.auth.getUser();

      const { error } = await supabase
        .from('aprovacoes_fipe_menor')
        .update({
          status: 'ciente',
          observacao_supervisor: observacao || null,
          supervisor_id: currentUser.user?.id || null,
          respondido_em: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['aprovacoes-fipe-menor'] });
      toast.success('Marcado como ciente');
    },
    onError: () => {
      toast.error('Erro ao marcar como ciente');
    },
  });
}

/**
 * @deprecated Use useRegistrarCienciaFipeMenor — Redução de Cota é automática.
 * Mantido como alias para evitar quebra de imports legados.
 */
export const useCriarSolicitacaoFipeMenor = useRegistrarCienciaFipeMenor;
