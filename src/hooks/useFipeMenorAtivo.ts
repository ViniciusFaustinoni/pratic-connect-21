import { useConfiguracoesAll } from './useConfiguracoesAll';

/**
 * Lê do cache global de configuracoes (1 fetch para a app inteira).
 * Antes este hook fazia seu próprio fetch isolado.
 */
export function useFipeMenorAtivo() {
  const { data, isLoading } = useConfiguracoesAll();
  const ativo = data?.['fipe_menor_ativo'] === 'true';
  // mantém o default histórico (true) enquanto carrega/sem registro
  return { fipeMenorAtivo: data ? ativo : true, isLoading };
}
