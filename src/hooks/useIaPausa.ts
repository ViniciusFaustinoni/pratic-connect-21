import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

const normalizar = (telefone: string) => telefone.replace(/\D/g, '');

export interface IaPausa {
  telefone: string;
  pausada_ate: string;
  motivo: 'intervencao_humana' | 'encerramento_atendimento';
  atendente_id: string | null;
}

export function useIaPausa(telefone: string | null) {
  const queryClient = useQueryClient();
  const tel = telefone ? normalizar(telefone) : null;

  const query = useQuery({
    queryKey: ['ia-pausa', tel],
    enabled: !!tel,
    refetchInterval: 30000,
    queryFn: async (): Promise<IaPausa | null> => {
      if (!tel) return null;
      const { data, error } = await (supabase as any)
        .from('whatsapp_ia_pausas')
        .select('*')
        .eq('telefone', tel)
        .maybeSingle();
      if (error) throw error;
      return (data as IaPausa | null) ?? null;
    },
  });

  // Tick para atualizar countdown a cada 10s
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 10000);
    return () => clearInterval(id);
  }, []);

  const ativa = !!query.data && new Date(query.data.pausada_ate) > new Date();

  const pausar = useMutation({
    mutationFn: async ({
      minutos,
      motivo,
    }: {
      minutos: number;
      motivo: 'intervencao_humana' | 'encerramento_atendimento';
    }) => {
      if (!tel) throw new Error('telefone vazio');
      const { data: { user } } = await supabase.auth.getUser();
      const pausada_ate = new Date(Date.now() + minutos * 60_000).toISOString();
      const { error } = await (supabase as any)
        .from('whatsapp_ia_pausas')
        .upsert(
          {
            telefone: tel,
            pausada_ate,
            motivo,
            atendente_id: user?.id ?? null,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'telefone' }
        );
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ia-pausa', tel] });
    },
  });

  return {
    pausa: query.data,
    ativa,
    pausarPorIntervencao: () => pausar.mutateAsync({ minutos: 10, motivo: 'intervencao_humana' }),
    pausarPorEncerramento: () => pausar.mutateAsync({ minutos: 1, motivo: 'encerramento_atendimento' }),
  };
}
