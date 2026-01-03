import { useMutation } from '@tanstack/react-query';

const SUPABASE_URL = 'https://iyxdgmukrrdkffraptsx.supabase.co';

interface FipeLookupParams {
  action: 'marcas' | 'modelos' | 'anos' | 'buscar-por-nome';
  tipo?: 'carros' | 'motos' | 'caminhoes';
  marca?: string;
  modelo?: string;
  ano?: string;
}

interface FipeResult {
  found: boolean;
  codigo?: string;
  valor?: string;
  valorNumerico?: number;
  mesReferencia?: string;
  marca?: string;
  modelo?: string;
  anoModelo?: number;
  combustivel?: string;
  error?: string;
}

export function useFipeLookup() {
  return useMutation({
    mutationFn: async (params: FipeLookupParams): Promise<FipeResult> => {
      const searchParams = new URLSearchParams();
      searchParams.set('action', params.action);
      
      if (params.tipo) searchParams.set('tipo', params.tipo);
      if (params.marca) searchParams.set('marca', params.marca);
      if (params.modelo) searchParams.set('modelo', params.modelo);
      if (params.ano) searchParams.set('ano', params.ano);

      const response = await fetch(
        `${SUPABASE_URL}/functions/v1/fipe-lookup?${searchParams.toString()}`
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Erro na consulta FIPE');
      }

      return response.json();
    },
  });
}

// Hook simplificado para buscar preço FIPE por marca/modelo/ano
export function useFipeSearch() {
  const fipeLookup = useFipeLookup();

  const searchFipe = async (marca: string, modelo: string, ano?: string) => {
    return fipeLookup.mutateAsync({
      action: 'buscar-por-nome',
      tipo: 'carros',
      marca,
      modelo,
      ano,
    });
  };

  return {
    searchFipe,
    isLoading: fipeLookup.isPending,
    error: fipeLookup.error,
    data: fipeLookup.data,
  };
}
