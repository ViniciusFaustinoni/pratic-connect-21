import { useConfiguracoesAll } from './useConfiguracoesAll';

/**
 * Lê `inclusao_bloquear_debito_outro_veiculo` do cache global de configurações.
 * Default: true (bloqueio ativo).
 */
export function useInclusaoBloqueioDebito() {
  const q = useConfiguracoesAll();
  const raw = q.data?.['inclusao_bloquear_debito_outro_veiculo'];
  const data = raw == null ? true : raw === 'true';
  return { ...q, data } as typeof q & { data: boolean };
}
