import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { SgaAssociadoCompleto } from './useBuscaSGA';

/**
 * Fallback local para o fluxo de Troca de Titularidade.
 * Roda via edge function `troca-titularidade-detalhe-associado` (service role)
 * para que vendedores CLT/externo/agência consigam enxergar o antigo titular
 * mesmo quando RLS o esconde do escopo deles.
 */
export interface FallbackLocalResult {
  payload: SgaAssociadoCompleto;
  /** placa normalizada → uuid local do veículo */
  placaParaId: Map<string, string>;
}

const normPlaca = (p?: string | null) =>
  (p || '').replace(/[^A-Z0-9]/gi, '').toUpperCase();

export function useTrocaTitularidadeFallbackLocal(
  associadoId: string | null | undefined,
  enabled = true,
) {
  return useQuery<FallbackLocalResult>({
    queryKey: ['troca-tit-fallback-local', associadoId],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke(
        'troca-titularidade-detalhe-associado',
        { body: { associadoId } },
      );
      if (error) throw error;
      const assoc = (data as any)?.associado ?? null;
      const veiculosLocais = ((data as any)?.veiculos ?? []) as any[];
      const cobrancas = ((data as any)?.cobrancas ?? []) as any[];

      const placaParaId = new Map<string, string>();
      for (const v of veiculosLocais) {
        if (v.placa) placaParaId.set(normPlaca(v.placa), v.id);
      }

      const veiculos = veiculosLocais.map((v) => {
        const cobsDoVeic = cobrancas.filter((c: any) => c.veiculo_id === v.id);
        const saldo = cobsDoVeic.reduce(
          (s: number, c: any) => s + Number(c.valor_final ?? c.valor ?? 0),
          0,
        );
        return {
          codigo_veiculo: 0,
          placa: v.placa || '',
          marca: v.marca ?? null,
          modelo: v.modelo ?? null,
          ano: v.ano_modelo ? String(v.ano_modelo) : v.ano_fabricacao ? String(v.ano_fabricacao) : null,
          saldo_devedor: saldo,
          boletos_abertos: cobsDoVeic.map((c: any) => ({
            nosso_numero: c.nosso_numero ?? null,
            valor: Number(c.valor_final ?? c.valor ?? 0),
            data_vencimento: c.data_vencimento ?? null,
            data_emissao: c.data_emissao ?? null,
            linha_digitavel: c.linha_digitavel ?? null,
            link_boleto: c.boleto_url ?? null,
            situacao_label: c.status ?? '',
          })),
        };
      });

      const saldoTotal = veiculos.reduce((s, v) => s + (v.saldo_devedor || 0), 0);

      const payload: SgaAssociadoCompleto = {
        encontrado: !!assoc && veiculos.length > 0,
        codigo_associado: assoc?.codigo_hinova ?? null,
        associado: assoc
          ? {
              nome: assoc.nome ?? null,
              cpf: assoc.cpf ?? null,
              email: assoc.email ?? null,
              telefone: assoc.telefone ?? null,
            }
          : null,
        veiculos,
        saldo_devedor_total: saldoTotal,
        tem_debito: saldoTotal > 0,
        origem_busca: 'cpf',
      };

      return { payload, placaParaId };
    },
    enabled: enabled && !!associadoId,
    staleTime: 30_000,
    gcTime: 2 * 60_000,
  });
}
