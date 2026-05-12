import { usePropostasPendentes } from './usePropostasPendentes';

/**
 * Contagem do badge da sidebar para "Propostas Pendentes".
 * Reusa EXATAMENTE a mesma query/regra da tela /cadastro/propostas
 * (usePropostasPendentes) para garantir paridade entre badge e lista.
 *
 * Como compartilha a mesma queryKey ['propostas-pendentes'] do React Query,
 * não há requisição extra: o hook apenas observa o cache.
 */
export function usePropostasPendentesCount() {
  const query = usePropostasPendentes();
  return {
    ...query,
    data: query.data?.length ?? 0,
  };
}
