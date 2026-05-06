import { useConfiguracoesAll } from './useConfiguracoesAll';

const FALLBACK = '0800 980 0001';

export function useConfig0800() {
  const { data } = useConfiguracoesAll();
  const telefone0800 = data?.['assistencia_telefone_central'] || FALLBACK;
  const telefone0800Link = telefone0800.replace(/\D/g, '');
  return { telefone0800, telefone0800Link };
}
