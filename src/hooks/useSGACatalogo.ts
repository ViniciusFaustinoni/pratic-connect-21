import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export type SGASituacao = 'ativo' | 'inativo' | 'todos';

export interface SGAProduto {
  codigo_produto?: string | number;
  // A API da Hinova retorna `decricao_produto` (sic) e `descricao_produto_boleto`
  decricao_produto?: string;
  descricao_produto_boleto?: string;
  descricao?: string;
  classificacao_produto?: string;
  vigente?: string;
  formato_cobranca?: string;
  base_cobranca?: string;
  codigo_tipo_veiculo?: string | number;
  descricao_tipo_veiculo?: string;
  valor?: number;
  valor_produto?: string;
  compulsorio?: string;
  padrao?: string;
  regionais?: Array<{ codigo_regional?: string | number; nome_regional?: string }>;
  cooperativas?: Array<{ codigo_cooperativa?: string | number; nome_cooperativa?: string }>;
  [k: string]: unknown;
}

export interface SGABeneficio {
  codigo_beneficio?: string | number;
  descricao?: string;
  situacao?: string;
  [k: string]: unknown;
}

interface CatalogoResponse<T> {
  cached: boolean;
  tipo: string;
  situacao?: string;
  endpoint?: string;
  data: T;
  error?: string;
}

async function fetchCatalogo<T>(params: {
  tipo: 'produtos' | 'beneficios';
  situacao?: SGASituacao;
  refresh?: boolean;
}): Promise<CatalogoResponse<T>> {
  const search = new URLSearchParams();
  search.set('tipo', params.tipo);
  if (params.situacao) search.set('situacao', params.situacao);
  if (params.refresh) search.set('refresh', '1');

  const { data, error } = await supabase.functions.invoke(
    `sga-listar-catalogo?${search.toString()}`,
    { method: 'GET' },
  );

  if (error) throw new Error(error.message ?? 'Erro ao consultar SGA');
  if (data?.error) throw new Error(data.error);
  return data as CatalogoResponse<T>;
}

function normalizeArray<T>(payload: unknown): T[] {
  if (Array.isArray(payload)) return payload as T[];
  if (payload && typeof payload === 'object') {
    const obj = payload as Record<string, unknown>;
    for (const key of ['data', 'produtos', 'beneficios', 'lista', 'items', 'result']) {
      if (Array.isArray(obj[key])) return obj[key] as T[];
    }
  }
  return [];
}

export function useSGAProdutos(refresh = false) {
  return useQuery({
    queryKey: ['sga-catalogo', 'produtos', refresh],
    queryFn: async () => {
      const resp = await fetchCatalogo<unknown>({ tipo: 'produtos', refresh });
      return {
        meta: { cached: resp.cached, endpoint: resp.endpoint },
        items: normalizeArray<SGAProduto>(resp.data),
        raw: resp.data,
      };
    },
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });
}

export function useSGABeneficios(situacao: SGASituacao = 'ativo', refresh = false) {
  return useQuery({
    queryKey: ['sga-catalogo', 'beneficios', situacao, refresh],
    queryFn: async () => {
      const resp = await fetchCatalogo<unknown>({ tipo: 'beneficios', situacao, refresh });
      return {
        meta: { cached: resp.cached, endpoint: resp.endpoint },
        items: normalizeArray<SGABeneficio>(resp.data),
        raw: resp.data,
      };
    },
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });
}
