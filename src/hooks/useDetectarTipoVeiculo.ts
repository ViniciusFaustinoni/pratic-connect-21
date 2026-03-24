import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { detectarTipoVeiculo } from '@/data/vistoriaConfigCompleta';

type TipoVeiculoResult = 'carro' | 'moto';

/**
 * Detecção dinâmica de tipo de veículo em 3 regras:
 * 1. Marca exclusiva de moto (config `marcas_exclusivas_moto` da tabela `configuracoes`)
 * 2. Marca mista (Honda, Yamaha etc.) → consulta `plano_elegibilidade_modelos` por linha_slug = 'advanced'
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
          // Suporta formato JSON array ["BMW","SUZUKI"] ou CSV "BMW,SUZUKI"
          let marcasList: string[] = [];
          const raw = configData.valor.trim();
          if (raw.startsWith('[')) {
            marcasList = JSON.parse(raw).map((m: string) => m.toUpperCase().trim());
          } else {
            marcasList = raw.split(',').map((m: string) => m.toUpperCase().trim());
          }

          if (marcasList.some(m => marcaNorm.includes(m) || m.includes(marcaNorm))) {
            return 'moto';
          }
        } catch {
          // Ignora parse error, segue para regra 2
        }
      }

      // ── Regra 2: Marca mista → consulta plano_elegibilidade_modelos ──
      if (modeloNorm) {
        const { data } = await supabase
          .from('plano_elegibilidade_modelos')
          .select('linha_slug')
          .ilike('marca', marcaNorm)
          .ilike('modelo', `%${modeloNorm}%`)
          .eq('is_active', true)
          .limit(5);

        if (data && data.length > 0) {
          return data.some(r => r.linha_slug === 'advanced') ? 'moto' : 'carro';
        }

        // Checar modelos genéricos ("TODOS OS MODELOS NACIONAIS" etc.)
        // MAS só classificar como moto se a marca NÃO tiver registros em linhas de carro
        const { data: genericData } = await supabase
          .from('plano_elegibilidade_modelos')
          .select('linha_slug, modelo')
          .ilike('marca', marcaNorm)
          .eq('linha_slug', 'advanced')
          .eq('is_active', true)
          .limit(10);

        if (genericData && genericData.length > 0) {
          const hasGeneric = genericData.some(r =>
            r.modelo?.toUpperCase().includes('TODOS') ||
            r.modelo?.toUpperCase().includes('NACIONAL') ||
            r.modelo?.toUpperCase().includes('IMPORTAD')
          );
          if (hasGeneric) {
            // Verificar se a marca também tem registros em linhas NÃO-advanced (marca mista)
            const { data: nonAdvanced } = await supabase
              .from('plano_elegibilidade_modelos')
              .select('id')
              .ilike('marca', marcaNorm)
              .neq('linha_slug', 'advanced')
              .eq('is_active', true)
              .limit(1);

            // Só classificar como moto se NÃO houver registros em outras linhas
            if (!nonAdvanced || nonAdvanced.length === 0) {
              return 'moto';
            }
            // Marca mista com genérico advanced → não conclusivo, segue para fallback
          }
        }
      }

      // Regra 2b: Só marca, sem modelo — se TODOS registros da marca são advanced → moto
      const { data: byMarca } = await supabase
        .from('plano_elegibilidade_modelos')
        .select('linha_slug')
        .ilike('marca', marcaNorm)
        .eq('is_active', true)
        .limit(50);

      if (byMarca && byMarca.length > 0) {
        const allAdvanced = byMarca.every(r => r.linha_slug === 'advanced');
        if (allAdvanced) return 'moto';
      }

      // Nenhuma regra conclusiva → fallback
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
