import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface RegiaoAtendimento {
  value: string;
  label: string;
}

/**
 * @deprecated Fallback hardcoded — usado apenas se a query falhar.
 * A fonte de verdade é a tabela configuracoes.chave = 'regioes_atendimento'.
 */
const FALLBACK_REGIOES: RegiaoAtendimento[] = [
  { value: 'sp_centro', label: 'São Paulo - Centro' },
  { value: 'sp_zona_sul', label: 'São Paulo - Zona Sul' },
  { value: 'sp_zona_norte', label: 'São Paulo - Zona Norte' },
  { value: 'sp_zona_leste', label: 'São Paulo - Zona Leste' },
  { value: 'sp_zona_oeste', label: 'São Paulo - Zona Oeste' },
  { value: 'abc', label: 'ABC Paulista' },
  { value: 'campinas', label: 'Campinas e Região' },
  { value: 'santos', label: 'Santos e Baixada' },
  { value: 'sorocaba', label: 'Sorocaba e Região' },
  { value: 'outros', label: 'Outras Regiões' },
];

/**
 * Hook que busca regiões de atendimento da tabela configuracoes.
 * Fonte única de verdade — substitui REGIOES_ATENDIMENTO hardcoded.
 */
export function useRegioesAtendimento() {
  const { data: regioes = FALLBACK_REGIOES, isLoading } = useQuery({
    queryKey: ['regioes-atendimento'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('configuracoes')
        .select('valor')
        .eq('chave', 'regioes_atendimento')
        .maybeSingle();

      if (error || !data?.valor) return FALLBACK_REGIOES;

      try {
        const parsed = JSON.parse(data.valor);
        return Array.isArray(parsed) ? parsed as RegiaoAtendimento[] : FALLBACK_REGIOES;
      } catch {
        return FALLBACK_REGIOES;
      }
    },
    staleTime: 30 * 60 * 1000, // 30 min
  });

  return { regioes, isLoading };
}
