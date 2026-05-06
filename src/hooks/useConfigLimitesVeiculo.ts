import { useConfiguracoesAll } from './useConfiguracoesAll';

interface LimitesVeiculo {
  fipeLimiteAutorizacao: number;
  fipeLimiteAutorizacaoMoto: number;
  idadeLimite: number;
  fipeMinimo: number;
  fipeMaximo: number;
  blindadoPolicy: 'autorizar' | 'bloquear';
}

const DEFAULTS: LimitesVeiculo = {
  fipeLimiteAutorizacao: 120000,
  fipeLimiteAutorizacaoMoto: 30000,
  idadeLimite: 15,
  fipeMinimo: 15000,
  fipeMaximo: 500000,
  blindadoPolicy: 'autorizar',
};

/** Lê do cache global (1 fetch para a app inteira). Mantém shape `useQuery`. */
export function useConfigLimitesVeiculo() {
  const q = useConfiguracoesAll();
  const map = q.data ?? {};
  const data: LimitesVeiculo = {
    fipeLimiteAutorizacao: Number(map['fipe_limite_autorizacao']) || DEFAULTS.fipeLimiteAutorizacao,
    fipeLimiteAutorizacaoMoto: Number(map['fipe_limite_autorizacao_moto']) || DEFAULTS.fipeLimiteAutorizacaoMoto,
    idadeLimite: Number(map['perfil_veiculo_idade_limite']) || DEFAULTS.idadeLimite,
    fipeMinimo: Number(map['perfil_veiculo_fipe_minimo']) || DEFAULTS.fipeMinimo,
    fipeMaximo: Number(map['perfil_veiculo_fipe_maximo']) || DEFAULTS.fipeMaximo,
    blindadoPolicy: ((map['aceitar_blindado'] as 'autorizar' | 'bloquear') || DEFAULTS.blindadoPolicy),
  };
  return { ...q, data } as typeof q & { data: LimitesVeiculo };
}
