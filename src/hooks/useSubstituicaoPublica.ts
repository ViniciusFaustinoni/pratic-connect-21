import { useQuery } from '@tanstack/react-query';
import { publicSupabase } from '@/integrations/supabase/publicClient';
import { useEffect } from 'react';

export interface SubstituicaoPublicaData {
  id: string;
  status: string;
  token_publico: string;
  associado_id: string;
  veiculo_antigo_placa: string | null;
  veiculo_antigo_modelo: string | null;
  veiculo_antigo_fipe: number | null;
  veiculo_novo_id: string | null;
  veiculo_novo_placa: string | null;
  veiculo_novo_modelo: string | null;
  veiculo_novo_fipe: number | null;
  mensalidade_nova: number | null;
  cota_participacao_nova: number | null;
  taxa_substituicao: number;
  valor_prorata: number | null;
  diferenca_mensalidade: number | null;
  beneficios_novos: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export function useSubstituicaoPublica(token: string | undefined) {
  const query = useQuery({
    queryKey: ['substituicao-publica', token],
    queryFn: async () => {
      if (!token) throw new Error('Token não fornecido');

      const { data, error } = await publicSupabase
        .from('substituicoes_veiculo')
        .select('*')
        .eq('token_publico', token)
        .single();

      if (error) throw error;
      return data as unknown as SubstituicaoPublicaData;
    },
    enabled: !!token,
    refetchInterval: 30_000,
    refetchIntervalInBackground: false,
  });

  // Realtime subscription for status changes
  useEffect(() => {
    if (!token || !query.data?.id) return;

    const channel = publicSupabase
      .channel(`substituicao-${query.data.id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'substituicoes_veiculo',
          filter: `id=eq.${query.data.id}`,
        },
        () => {
          query.refetch();
        }
      )
      .subscribe();

    return () => {
      publicSupabase.removeChannel(channel);
    };
  }, [token, query.data?.id]);

  return query;
}
