import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { SgaAssociadoCompleto } from './useBuscaSGA';

/**
 * Fallback local para o fluxo de Troca de Titularidade.
 * Quando o SGA está indisponível ou não retorna o associado/veículos,
 * monta um payload no shape `SgaAssociadoCompleto` a partir das tabelas
 * locais (`associados`, `veiculos`, `cobrancas`).
 *
 * Inclui também um Map placa → UUID local (já que aqui não dependemos
 * de placas SGA → espelho local).
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
      const [assocRes, veicRes, cobRes] = await Promise.all([
        supabase
          .from('associados')
          .select('id, nome, cpf, email, telefone, codigo_hinova')
          .eq('id', associadoId!)
          .maybeSingle(),
        supabase
          .from('veiculos')
          .select('id, placa, marca, modelo, ano_modelo, ano_fabricacao, status, ativo')
          .eq('associado_id', associadoId!)
          .neq('status', 'cancelado'),
        supabase
          .from('cobrancas')
          .select('id, veiculo_id, status, valor_final, valor, data_vencimento, data_emissao, linha_digitavel, boleto_url, nosso_numero')
          .eq('associado_id', associadoId!)
          .in('status', ['aberto', 'vencido', 'pendente', 'em_aberto']),
      ]);

      const assoc = assocRes.data as any;
      const veiculosLocais = (veicRes.data || []).filter((v: any) => v.ativo !== false);
      const cobrancas = cobRes.data || [];

      const placaParaId = new Map<string, string>();
      for (const v of veiculosLocais as any[]) {
        if (v.placa) placaParaId.set(normPlaca(v.placa), v.id);
      }

      const veiculos = (veiculosLocais as any[]).map((v) => {
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
