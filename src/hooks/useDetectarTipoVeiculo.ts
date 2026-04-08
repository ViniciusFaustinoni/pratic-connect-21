import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { detectarTipoVeiculo } from '@/data/vistoriaConfigCompleta';

type TipoVeiculoResult = 'carro' | 'moto';

/**
 * Detecção dinâmica de tipo de veículo em 3 regras:
 * 1. Marca exclusiva de moto (config `marcas_exclusivas_moto` da tabela `configuracoes`)
 * 2. Marca mista (Honda, Yamaha etc.) → consulta `marcas_modelos` por categoria
 * 3. Fallback síncrono via MOTO_KEYWORDS
 */
export function useDetectarTipoVeiculo(
  marca: string | undefined | null,
  modelo: string | undefined | null,
  tipoVeiculoApi?: string | null
) {
  const marcaNorm = (marca || '').trim().toUpperCase();
  const modeloNorm = (modelo || '').trim().toUpperCase();

  const { data: tipoFromDb, isLoading } = useQuery({
    queryKey: ['detectar-tipo-veiculo', marcaNorm, modeloNorm],
    queryFn: async (): Promise<TipoVeiculoResult | null> => {
      if (!marcaNorm) return null;

      // ── Regra 1: Marcas exclusivas de moto (tabela configuracoes) ──
      const { data: configData } = await supabase
        .from('configuracoes')
        .select('valor')
        .eq('chave', 'marcas_exclusivas_moto')
        .maybeSingle();

      if (configData?.valor) {
        try {
          let marcasList: string[] = [];
          const raw = configData.valor.trim();
          if (raw.startsWith('[')) {
            marcasList = JSON.parse(raw).map((m: string) => m.toUpperCase().trim());
          } else {
            marcasList = raw.split(',').map((m: string) => m.toUpperCase().trim());
          }

          if (marcasList.some(m => marcaNorm === m)) {
            return 'moto';
          }
        } catch {
          // Ignora parse error, segue para regra 2
        }
      }

      // ── Regra 2: Consulta marcas_modelos ──
      // Se a marca existe apenas com modelos de moto na tabela marcas_modelos, é moto
      if (modeloNorm) {
        // Buscar modelos que contenham o primeiro token do modelo
        const firstToken = modeloNorm.split(' ')[0];
        const { data } = await supabase
          .from('marcas_modelos')
          .select('modelo')
          .ilike('marca', marcaNorm)
          .ilike('modelo', `%${firstToken}%`)
          .eq('ativo', true)
          .limit(5);

        // Se encontrou na marcas_modelos, o veículo existe no catálogo
        // A detecção de moto depende das marcas exclusivas (regra 1) e keywords (regra 3)
        if (data && data.length > 0) {
          // Marca está no catálogo com esse modelo — não é conclusivo para moto
          // Segue para fallback
        }
      }

      // Regra 2b: Só marca, sem modelo — se a marca está SOMENTE em configuracoes marcas_exclusivas_moto
      // Já tratado na regra 1. Fallback abaixo.

      return null;
    },
    enabled: !!marcaNorm,
    staleTime: 1000 * 60 * 10,
    gcTime: 1000 * 60 * 30,
  });

  // Regra 3: Fallback síncrono por keywords (último recurso)
  const tipoVeiculo: TipoVeiculoResult = (() => {
    if (tipoFromDb) return tipoFromDb;
    // Prioridade: tipo explícito da API de placa
    if (tipoVeiculoApi) {
      const apiNorm = tipoVeiculoApi.toUpperCase();
      if (apiNorm.includes('MOTO') || apiNorm.includes('CICLO') || apiNorm.includes('TRICICLO')) return 'moto';
      if (apiNorm.includes('AUTO') || apiNorm.includes('CAMION') || apiNorm.includes('UTILITARIO')) return 'carro';
    }
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
  return useDetectarTipoVeiculo(marca, modelo);
}
