import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export function useFipeMenorAtivo() {
  const { data: ativo = true, isLoading } = useQuery({
    queryKey: ['config-fipe-menor-ativo'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('configuracoes')
        .select('valor')
        .eq('chave', 'fipe_menor_ativo')
        .maybeSingle();
      if (error) throw error;
      return data?.valor === 'true';
    },
    staleTime: 5 * 60 * 1000, // 5 min
  });

  return { fipeMenorAtivo: ativo, isLoading };
}
