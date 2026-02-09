import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { SubstituicaoVeiculo, StatusSubstituicao } from '@/types/substituicao';

// =============================================
// QUERIES
// =============================================

/** Lista substituições de um associado (ou todas se sem filtro) */
export function useSubstituicoes(associadoId?: string) {
  return useQuery({
    queryKey: ['substituicoes', associadoId],
    queryFn: async () => {
      let query = supabase
        .from('substituicoes_veiculo')
        .select('*, associado:associados(id, nome, cpf), veiculo_antigo:veiculos!substituicoes_veiculo_veiculo_antigo_id_fkey(id, placa, modelo, marca), veiculo_novo:veiculos!substituicoes_veiculo_veiculo_novo_id_fkey(id, placa, modelo, marca)')
        .order('created_at', { ascending: false });

      if (associadoId) {
        query = query.eq('associado_id', associadoId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as (SubstituicaoVeiculo & {
        associado: { id: string; nome: string; cpf: string } | null;
        veiculo_antigo: { id: string; placa: string; modelo: string; marca: string } | null;
        veiculo_novo: { id: string; placa: string; modelo: string; marca: string } | null;
      })[];
    },
  });
}

/** Busca uma substituição específica */
export function useSubstituicao(id: string | undefined) {
  return useQuery({
    queryKey: ['substituicoes', 'detail', id],
    queryFn: async () => {
      if (!id) throw new Error('ID é obrigatório');

      const { data, error } = await supabase
        .from('substituicoes_veiculo')
        .select('*, associado:associados(id, nome, cpf, telefone, email), veiculo_antigo:veiculos!substituicoes_veiculo_veiculo_antigo_id_fkey(*), veiculo_novo:veiculos!substituicoes_veiculo_veiculo_novo_id_fkey(*)')
        .eq('id', id)
        .single();

      if (error) throw error;
      return data as SubstituicaoVeiculo & {
        associado: Record<string, unknown> | null;
        veiculo_antigo: Record<string, unknown> | null;
        veiculo_novo: Record<string, unknown> | null;
      };
    },
    enabled: !!id,
  });
}

// =============================================
// MUTATIONS
// =============================================

interface IniciarSubstituicaoParams {
  associado_id: string;
  veiculo_antigo_id: string;
  veiculo_antigo_placa: string;
  veiculo_antigo_modelo: string;
  veiculo_antigo_fipe: number;
  mensalidade_antiga: number;
  cota_participacao_antiga: number;
  observacoes?: string;
}

/** Inicia uma nova substituição de veículo */
export function useIniciarSubstituicao() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: IniciarSubstituicaoParams) => {
      const { data: userData } = await supabase.auth.getUser();

      const { data, error } = await supabase
        .from('substituicoes_veiculo')
        .insert({
          ...params,
          status: 'iniciada' as string,
          criado_por: userData.user?.id,
        })
        .select()
        .single();

      if (error) throw error;
      return data as unknown as SubstituicaoVeiculo;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['substituicoes'] });
      queryClient.invalidateQueries({ queryKey: ['veiculos', undefined] });
      queryClient.invalidateQueries({ queryKey: ['veiculos', data.associado_id] });
    },
  });
}

/** Atualiza campos de uma substituição */
export function useAtualizarSubstituicao() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...updates }: { id: string } & Partial<Record<string, unknown>>) => {
      const { data, error } = await supabase
        .from('substituicoes_veiculo')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data as unknown as SubstituicaoVeiculo;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['substituicoes'] });
      queryClient.invalidateQueries({ queryKey: ['substituicoes', 'detail', data.id] });
    },
  });
}

/** Aprova uma substituição */
export function useAprovarSubstituicao() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { data: userData } = await supabase.auth.getUser();

      const { data, error } = await supabase
        .from('substituicoes_veiculo')
        .update({
          status: 'aprovada' as string,
          aprovado_por: userData.user?.id,
          aprovado_em: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data as unknown as SubstituicaoVeiculo;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['substituicoes'] });
      queryClient.invalidateQueries({ queryKey: ['substituicoes', 'detail', data.id] });
    },
  });
}

/** Rejeita uma substituição */
export function useRejeitarSubstituicao() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, motivo }: { id: string; motivo: string }) => {
      const { data: userData } = await supabase.auth.getUser();

      const { data, error } = await supabase
        .from('substituicoes_veiculo')
        .update({
          status: 'rejeitada' as string,
          motivo_rejeicao: motivo,
          rejeitado_por: userData.user?.id,
          rejeitado_em: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data as unknown as SubstituicaoVeiculo;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['substituicoes'] });
      queryClient.invalidateQueries({ queryKey: ['substituicoes', 'detail', data.id] });
    },
  });
}

/** Efetiva a substituição (troca de veículos) */
export function useEfetivarSubstituicao() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, veiculo_novo_id }: { id: string; veiculo_novo_id: string }) => {
      // 1. Buscar substituição
      const { data: subst, error: fetchErr } = await supabase
        .from('substituicoes_veiculo')
        .select('*')
        .eq('id', id)
        .single();

      if (fetchErr || !subst) throw fetchErr || new Error('Substituição não encontrada');

      const veiculoAntigoId = subst.veiculo_antigo_id;

      // 2. Inativar veículo antigo
      const { error: errAntigo } = await supabase
        .from('veiculos')
        .update({
          ativo: false,
          principal: false,
          substituido_por: veiculo_novo_id,
          data_inativacao: new Date().toISOString(),
          motivo_inativacao: 'substituicao',
          substituicao_id: id,
        })
        .eq('id', veiculoAntigoId);

      if (errAntigo) throw errAntigo;

      // 3. Ativar veículo novo como principal
      const { error: errNovo } = await supabase
        .from('veiculos')
        .update({
          ativo: true,
          principal: true,
          substituicao_id: id,
        })
        .eq('id', veiculo_novo_id);

      if (errNovo) throw errNovo;

      // 4. Atualizar substituição
      const { data, error: errSubst } = await supabase
        .from('substituicoes_veiculo')
        .update({
          status: 'efetivada' as string,
          veiculo_novo_id,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
        .select()
        .single();

      if (errSubst) throw errSubst;

      // 5. Registrar no histórico do associado
      try {
        await supabase.from('associados_historico').insert({
          associado_id: subst.associado_id,
          tipo: 'substituicao_veiculo',
          descricao: `Substituição de veículo efetivada. Antigo: ${subst.veiculo_antigo_placa || 'N/A'}, Novo: ${(data as Record<string, unknown>).veiculo_novo_placa || 'N/A'}`,
          metadata: { substituicao_id: id, veiculo_antigo_id: veiculoAntigoId, veiculo_novo_id },
        });
      } catch (e) {
        console.warn('[useEfetivarSubstituicao] Erro ao registrar histórico:', e);
      }

      return data as unknown as SubstituicaoVeiculo;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['substituicoes'] });
      queryClient.invalidateQueries({ queryKey: ['substituicoes', 'detail', data.id] });
      queryClient.invalidateQueries({ queryKey: ['veiculos'] });
      queryClient.invalidateQueries({ queryKey: ['associados'] });
    },
  });
}

// =============================================
// ELEGIBILIDADE
// =============================================

interface ElegibilidadeResult {
  adimplente: boolean;
  rastreador_devolvido: boolean;
  evento_ativo: {
    tem: boolean;
    tipo: 'terceiros' | 'proprio' | null;
    evento_id: string | null;
  };
  elegivel: boolean;
}

/** Verifica se o associado é elegível para substituição */
export function useVerificarElegibilidade(associadoId: string | undefined) {
  return useQuery({
    queryKey: ['substituicoes', 'elegibilidade', associadoId],
    queryFn: async (): Promise<ElegibilidadeResult> => {
      if (!associadoId) throw new Error('associado_id obrigatório');

      // Buscar veículo ativo do associado para checar sinistros
      const veiculoPromise = supabase
        .from('veiculos')
        .select('id')
        .eq('associado_id', associadoId)
        .eq('ativo', true)
        .limit(1)
        .maybeSingle();

      // Cobranças em aberto (asaas_cobrancas)
      const cobrancasPromise = supabase
        .from('asaas_cobrancas')
        .select('id, status')
        .eq('associado_id', associadoId)
        .in('status', ['PENDING', 'OVERDUE'])
        .limit(1);

      // Dados do associado (pendência rastreador)
      const associadoPromise = supabase
        .from('associados')
        .select('pendencia_rastreador')
        .eq('id', associadoId)
        .single();

      const [veiculoRes, cobrancasRes, associadoRes] = await Promise.all([
        veiculoPromise,
        cobrancasPromise,
        associadoPromise,
      ]);

      if (associadoRes.error) throw associadoRes.error;

      const pendenciaRastreador = associadoRes.data?.pendencia_rastreador ?? false;
      const temCobrancasAberto = (cobrancasRes.data?.length ?? 0) > 0;
      const adimplente = !temCobrancasAberto;
      const rastreador_devolvido = !pendenciaRastreador;

      // Sinistros ativos do veículo
      let eventoAtivo: ElegibilidadeResult['evento_ativo'] = { tem: false, tipo: null, evento_id: null };

      if (veiculoRes.data?.id) {
        const { data: sinistros } = await supabase
          .from('sinistros')
          .select('id, tipo')
          .eq('veiculo_id', veiculoRes.data.id)
          .not('status', 'in', '("concluido","negado","encerrado")')
          .limit(1);

        if (sinistros && sinistros.length > 0) {
          const s = sinistros[0];
          const tipo = (s.tipo as string)?.includes('terceiro') ? 'terceiros' : 'proprio';
          eventoAtivo = { tem: true, tipo, evento_id: s.id };
        }
      }

      const elegivel = adimplente && rastreador_devolvido && (!eventoAtivo.tem || eventoAtivo.tipo === 'terceiros');

      return { adimplente, rastreador_devolvido, evento_ativo: eventoAtivo, elegivel };
    },
    enabled: !!associadoId,
  });
}
