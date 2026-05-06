import { useMemo } from 'react';
import { useConfiguracoesAll } from './useConfiguracoesAll';

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
  { value: 'rj_centro', label: 'Rio de Janeiro - Centro' },
  { value: 'rj_zona_sul', label: 'Rio de Janeiro - Zona Sul' },
  { value: 'rj_zona_norte', label: 'Rio de Janeiro - Zona Norte' },
  { value: 'rj_zona_oeste', label: 'Rio de Janeiro - Zona Oeste' },
  { value: 'niteroi_sao_goncalo', label: 'Niterói e São Gonçalo' },
  { value: 'baixada_fluminense', label: 'Baixada Fluminense' },
  { value: 'regiao_dos_lagos', label: 'Região dos Lagos' },
  { value: 'regiao_serrana_rj', label: 'Região Serrana' },
  { value: 'outros', label: 'Outras Regiões' },
];

/**
 * Hook que busca regiões de atendimento da tabela configuracoes.
 * Fase 5: agora consome o cache global `useConfiguracoesAll` (RPC get_app_config),
 * eliminando o fetch dedicado a `/configuracoes?chave=regioes_atendimento`.
 */
export function useRegioesAtendimento() {
  const { data: configs, isLoading } = useConfiguracoesAll();

  const regioes = useMemo<RegiaoAtendimento[]>(() => {
    const raw = configs?.['regioes_atendimento'];
    if (!raw) return FALLBACK_REGIOES;
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? (parsed as RegiaoAtendimento[]) : FALLBACK_REGIOES;
    } catch {
      return FALLBACK_REGIOES;
    }
  }, [configs]);

  return { regioes, isLoading };
}
