import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

const FALLBACK = '0800 980 0001';

export function useConfig0800() {
  const { data } = useQuery({
    queryKey: ['config-0800'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('configuracoes')
        .select('valor')
        .eq('chave', 'assistencia_telefone_central')
        .maybeSingle();
      if (error) throw error;
      return data?.valor || FALLBACK;
    },
    staleTime: 10 * 60 * 1000, // 10 minutes
    gcTime: 15 * 60 * 1000,
  });

  const telefone0800 = data || FALLBACK;
  const telefone0800Link = telefone0800.replace(/\D/g, '');

  return { telefone0800, telefone0800Link };
}
