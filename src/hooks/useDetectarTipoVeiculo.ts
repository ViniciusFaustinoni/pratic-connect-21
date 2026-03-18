import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { detectarTipoVeiculo } from '@/data/vistoriaConfigCompleta';

type TipoVeiculoResult = 'carro' | 'moto';

/**
 * Detecção dinâmica de tipo de veículo via plano_elegibilidade_modelos.
 * Se a marca+modelo tem registros com linha_slug = 'advanced' → moto.
 * Se tem registros com outras linhas → carro.
 * Fallback: keywords hardcoded (detectarTipoVeiculo síncrono).
 */
export function useDetectarTipoVeiculo(
  marca: string | undefined | null,
  modelo: string | undefined | null
) {
  const marcaNorm = (marca || '').trim().toUpperCase();
  const modeloNorm = (modelo || '').trim().toUpperCase();

  const { data: tipoFromDb, isLoading } = useQuery({
    queryKey: ['detectar-tipo-veiculo', marcaNorm, modeloNorm],
    queryFn: async (): Promise<TipoVeiculoResult | null> => {
      if (!marcaNorm) return null;

      // Query 1: buscar por marca + modelo (mais preciso)
      if (modeloNorm) {
        const { data } = await supabase
          .from('plano_elegibilidade_modelos')
          .select('linha_slug')
          .ilike('marca', marcaNorm)
          .ilike('modelo', `%${modeloNorm}%`)
          .eq('is_active', true)
          .limit(5);

        if (data && data.length > 0) {
          const hasAdvanced = data.some(r => r.linha_slug === 'advanced');
          return hasAdvanced ? 'moto' : 'carro';
        }
      }

      // Query 2: buscar só por marca (fallback parcial)
      const { data: byMarca } = await supabase
        .from('plano_elegibilidade_modelos')
        .select('linha_slug')
        .ilike('marca', marcaNorm)
        .eq('is_active', true)
        .limit(50);

      if (byMarca && byMarca.length > 0) {
        // Se TODOS os registros da marca são 'advanced', é uma marca exclusiva de moto
        const allAdvanced = byMarca.every(r => r.linha_slug === 'advanced');
        if (allAdvanced) return 'moto';

        // Se tem mix, não podemos decidir só pela marca — retornar null para cair no fallback
        return null;
      }

      // Nenhum registro encontrado — fallback
      return null;
    },
    enabled: !!marcaNorm,
    staleTime: 1000 * 60 * 10, // 10 min
    gcTime: 1000 * 60 * 30,
  });

  // Fallback síncrono por keywords
  const tipoVeiculo: TipoVeiculoResult = (() => {
    if (tipoFromDb) return tipoFromDb;
    if (!marca && !modelo) return 'carro';
    const tipo = detectarTipoVeiculo(undefined, modelo, marca);
    return tipo === 'moto' ? 'moto' : 'carro';
  })();

  return { tipoVeiculo, isLoading };
}

/**
 * Versão para cotação pública usando publicSupabase.
 */
export function useDetectarTipoVeiculoPublico(
  marca: string | undefined | null,
  modelo: string | undefined | null
) {
  // Reutiliza a mesma lógica — plano_elegibilidade_modelos é acessível via anon
  return useDetectarTipoVeiculo(marca, modelo);
}
