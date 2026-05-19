import { useMutation } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

/**
 * Informações de uma cotação existente para a mesma placa
 */
export interface PlacaDuplicadaInfo {
  cotacaoId: string;
  numero: string;
  /**
   * auth.users.id do vendedor dono da cotação (é isso que `cotacoes.vendedor_id`
   * armazena historicamente — NÃO é `profiles.id`). Use este campo para
   * comparar com `user?.id` (auth) e nunca com `profile?.id`.
   */
  vendedorUserId: string;
  /** @deprecated use `vendedorUserId`. Mantido temporariamente por compat. */
  vendedorId: string;
  vendedorNome: string;
  createdAt: string;
  status: string;
}

/**
 * Normaliza a placa removendo caracteres especiais e convertendo para uppercase
 */
const normalizarPlaca = (placa: string): string => {
  return placa.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
};

/**
 * Verifica se existe cotação ativa para a placa informada
 * 
 * Regras:
 * - Cotações ativas: status = rascunho, enviada, aceita
 * - Período: últimas 48 horas
 * - Retorna dados do vendedor responsável se existir
 */
export interface VerificarPlacaParams {
  placa: string;
  /** IDs de cotações a ignorar (ex.: cotação original em fluxo de duplicação) */
  ignorarIds?: string[];
}

export function useVerificarPlacaDuplicada() {
  return useMutation({
    mutationFn: async (
      params: string | VerificarPlacaParams,
    ): Promise<PlacaDuplicadaInfo | null> => {
      const placa = typeof params === 'string' ? params : params.placa;
      const ignorarIds = typeof params === 'string' ? [] : (params.ignorarIds ?? []);
      const placaNormalizada = normalizarPlaca(placa);

      if (!placaNormalizada || placaNormalizada.length < 7) {
        return null;
      }

      // Calcula data limite (48 horas atrás)
      const dataLimite = new Date();
      dataLimite.setHours(dataLimite.getHours() - 48);

      let query = supabase
        .from('cotacoes')
        .select(`
          id,
          numero,
          vendedor_id,
          created_at,
          status
        `)
        .eq('veiculo_placa', placaNormalizada)
        .in('status', ['rascunho', 'enviada', 'aceita'])
        .gte('created_at', dataLimite.toISOString())
        .order('created_at', { ascending: false })
        .limit(5);

      const { data, error } = await query;

      if (error) {
        console.error('Erro ao verificar placa duplicada:', error);
        return null;
      }

      const filtradas = (data ?? []).filter((c) => !ignorarIds.includes(c.id));

      if (filtradas.length === 0) {
        return null;
      }

      const cotacao = filtradas[0];
      
      // Buscar nome do vendedor separadamente.
      // IMPORTANTE: `cotacoes.vendedor_id` armazena `auth.users.id`, então o
      // join correto em `profiles` é por `user_id` (NÃO por `id`).
      let vendedorNome = 'Consultor não identificado';
      if (cotacao.vendedor_id) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('nome, email')
          .eq('user_id', cotacao.vendedor_id)
          .maybeSingle();
        if (profile?.nome) {
          vendedorNome = profile.nome;
        } else if (profile?.email) {
          vendedorNome = profile.email;
        } else {
          vendedorNome = `Consultor (${cotacao.vendedor_id.slice(0, 8)})`;
        }
      }
      
      return {
        cotacaoId: cotacao.id,
        numero: cotacao.numero || '',
        vendedorUserId: cotacao.vendedor_id || '',
        vendedorId: cotacao.vendedor_id || '',
        vendedorNome,
        createdAt: cotacao.created_at,
        status: cotacao.status || '',
      };
    },
  });
}
