import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface LimitesVeiculo {
  fipeLimiteAutorizacao: number;
  idadeLimite: number;
  fipeMinimo: number;
  fipeMaximo: number;
}

const DEFAULTS: LimitesVeiculo = {
  fipeLimiteAutorizacao: 120000,
  idadeLimite: 15,
  fipeMinimo: 15000,
  fipeMaximo: 500000,
};

const CHAVES = [
  'fipe_limite_autorizacao',
  'perfil_veiculo_idade_limite',
  'perfil_veiculo_fipe_minimo',
  'perfil_veiculo_fipe_maximo',
] as const;

export function useConfigLimitesVeiculo() {
  return useQuery<LimitesVeiculo>({
    queryKey: ['config-limites-veiculo'],
    queryFn: async () => {
      const { data } = await supabase
        .from('configuracoes')
        .select('chave, valor')
        .in('chave', [...CHAVES]);

      if (!data?.length) return DEFAULTS;

      const map = Object.fromEntries(data.map((r) => [r.chave, Number(r.valor)]));

      return {
        fipeLimiteAutorizacao: map['fipe_limite_autorizacao'] || DEFAULTS.fipeLimiteAutorizacao,
        idadeLimite: map['perfil_veiculo_idade_limite'] || DEFAULTS.idadeLimite,
        fipeMinimo: map['perfil_veiculo_fipe_minimo'] || DEFAULTS.fipeMinimo,
        fipeMaximo: map['perfil_veiculo_fipe_maximo'] || DEFAULTS.fipeMaximo,
      };
    },
    staleTime: 5 * 60 * 1000,
  });
}
