import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface LimitesVeiculo {
  fipeLimiteAutorizacao: number;
  idadeLimite: number;
  fipeMinimo: number;
  fipeMaximo: number;
  blindadoPolicy: 'autorizar' | 'bloquear';
}

const DEFAULTS: LimitesVeiculo = {
  fipeLimiteAutorizacao: 120000,
  idadeLimite: 15,
  fipeMinimo: 15000,
  fipeMaximo: 500000,
  blindadoPolicy: 'autorizar',
};

const CHAVES = [
  'fipe_limite_autorizacao',
  'perfil_veiculo_idade_limite',
  'perfil_veiculo_fipe_minimo',
  'perfil_veiculo_fipe_maximo',
  'aceitar_blindado',
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

      const mapStr = Object.fromEntries(data.map((r) => [r.chave, r.valor]));

      return {
        fipeLimiteAutorizacao: Number(mapStr['fipe_limite_autorizacao']) || DEFAULTS.fipeLimiteAutorizacao,
        idadeLimite: Number(mapStr['perfil_veiculo_idade_limite']) || DEFAULTS.idadeLimite,
        fipeMinimo: Number(mapStr['perfil_veiculo_fipe_minimo']) || DEFAULTS.fipeMinimo,
        fipeMaximo: Number(mapStr['perfil_veiculo_fipe_maximo']) || DEFAULTS.fipeMaximo,
        blindadoPolicy: (mapStr['aceitar_blindado'] as 'autorizar' | 'bloquear') || DEFAULTS.blindadoPolicy,
      };
    },
    staleTime: 5 * 60 * 1000,
  });
}
