import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { detectarTipoVeiculo } from '@/data/vistoriaConfigCompleta';

type TipoVeiculoResult = 'carro' | 'moto';

/**
 * Detecção canônica de tipo de veículo (carro|moto).
 *
 * Fonte da verdade: RPC `fn_detectar_tipo_veiculo(marca, modelo)` no banco —
 * mesma sequência usada por `fn_veiculo_precisa_rastreador` e pela edge
 * `contrato-gerar` (catálogo `marcas_modelos.tipo_veiculo` →
 * `configuracoes.marcas_exclusivas_moto` → regex de keywords).
 *
 * Ordem de prioridade:
 *  1. `snapshotTipo` (cotacoes.tipo_veiculo / contratos.tipo_veiculo) — vence.
 *  2. Tipo explícito da API de placa (`tipoVeiculoApi`).
 *  3. RPC canônica (cacheada por 10min/par marca+modelo).
 *  4. Fallback síncrono `detectarTipoVeiculo` (keywords locais) enquanto a
 *     RPC carrega ou falha.
 */
export function useDetectarTipoVeiculo(
  marca: string | undefined | null,
  modelo: string | undefined | null,
  tipoVeiculoApi?: string | null,
  snapshotTipo?: 'carro' | 'moto' | null,
) {
  const marcaNorm = (marca || '').trim();
  const modeloNorm = (modelo || '').trim();

  const { data: tipoFromRpc, isLoading } = useQuery({
    queryKey: ['fn_detectar_tipo_veiculo', marcaNorm.toUpperCase(), modeloNorm.toUpperCase()],
    queryFn: async (): Promise<TipoVeiculoResult | null> => {
      if (!marcaNorm && !modeloNorm) return null;
      const { data, error } = await supabase.rpc('fn_detectar_tipo_veiculo', {
        _marca: marcaNorm,
        _modelo: modeloNorm,
      });
      if (error) {
        console.warn('[useDetectarTipoVeiculo] RPC falhou, caindo em fallback síncrono', error);
        return null;
      }
      return data === 'moto' ? 'moto' : 'carro';
    },
    enabled: !snapshotTipo && (!!marcaNorm || !!modeloNorm),
    staleTime: 1000 * 60 * 10,
    gcTime: 1000 * 60 * 30,
  });

  const tipoVeiculo: TipoVeiculoResult = (() => {
    // 1) Snapshot canônico sempre vence.
    if (snapshotTipo === 'moto' || snapshotTipo === 'carro') return snapshotTipo;

    // 2) Tipo explícito da API de placa.
    if (tipoVeiculoApi) {
      const apiNorm = tipoVeiculoApi.toUpperCase();
      if (apiNorm.includes('MOTO') || apiNorm.includes('CICLO') || apiNorm.includes('TRICICLO')) return 'moto';
      if (apiNorm.includes('AUTO') || apiNorm.includes('CAMION') || apiNorm.includes('UTILITARIO')) return 'carro';
    }

    // 3) RPC canônica.
    if (tipoFromRpc) return tipoFromRpc;

    // 4) Fallback síncrono (sem rede / antes da RPC resolver).
    if (!marca && !modelo) return 'carro';
    const tipo = detectarTipoVeiculo(undefined, modelo, marca);
    return tipo === 'moto' ? 'moto' : 'carro';
  })();

  return { tipoVeiculo, isLoading };
}

/**
 * Versão para cotação pública. A RPC `fn_detectar_tipo_veiculo` é GRANTed
 * para `anon`, então o cliente público funciona sem mudanças.
 */
export function useDetectarTipoVeiculoPublico(
  marca: string | undefined | null,
  modelo: string | undefined | null,
) {
  return useDetectarTipoVeiculo(marca, modelo);
}
