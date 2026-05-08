import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface BoletoAbertoSGA {
  nosso_numero: string | null;
  valor: number;
  data_vencimento: string | null;
  data_emissao: string | null;
  linha_digitavel: string | null;
  link_boleto: string | null;
  situacao_label: string;
}

export interface VeiculoSGA {
  codigo_veiculo: number;
  placa: string;
  marca: string | null;
  modelo: string | null;
  ano: string | null;
  saldo_devedor: number;
  boletos_abertos: BoletoAbertoSGA[];
}

export interface SgaAssociadoCompleto {
  encontrado: boolean;
  codigo_associado: number | null;
  associado: { nome: string | null; cpf: string | null; email: string | null; telefone: string | null } | null;
  veiculos: VeiculoSGA[];
  saldo_devedor_total: number;
  tem_debito: boolean;
  origem_busca: 'cpf' | 'placa';
  erro_transitorio?: boolean;
  motivo?: string;
  retry_em?: string;
}

interface BuscaInput {
  cpf?: string;
  placa?: string;
  enabled?: boolean;
}

const empty = (origem: 'cpf' | 'placa'): SgaAssociadoCompleto => ({
  encontrado: false,
  codigo_associado: null,
  associado: null,
  veiculos: [],
  saldo_devedor_total: 0,
  tem_debito: false,
  origem_busca: origem,
});

/**
 * Erro interno usado para forçar o React Query a aplicar a política de retry
 * quando o edge devolve `erro_transitorio: true` (HTTP 200 com payload vazio).
 * Sem isso, o RQ não retentaria — o backend devolve 200 propositalmente para
 * não quebrar `supabase.functions.invoke()`.
 */
class SgaTransientFetchError extends Error {
  payload: SgaAssociadoCompleto;
  constructor(payload: SgaAssociadoCompleto) {
    super(payload.motivo || 'sga_transitorio');
    this.payload = payload;
    this.name = 'SgaTransientFetchError';
  }
}

/**
 * Hook central que consulta o SGA (Hinova) durante o fluxo de cotação.
 * Substitui as queries diretas em `associados`/`veiculos`/`cobrancas` locais.
 *
 * Retorna {encontrado, codigo_associado, associado, veiculos[], saldo_devedor_total,
 *          tem_debito, boletos_abertos por veículo, erro_transitorio?, motivo?}.
 *
 * Quando o edge retorna `erro_transitorio: true`, o hook lança internamente um
 * erro controlado para retentar (3x, backoff exponencial). Se persistir, devolve
 * `{...empty, erro_transitorio: true, motivo}` para a UI mostrar banner de retry
 * em vez de afirmar "nenhum resultado".
 */
export function useBuscaSGA({ cpf, placa, enabled = true }: BuscaInput) {
  const cpfLimpo = (cpf || '').replace(/\D/g, '');
  const placaLimpa = (placa || '').replace(/[^A-Za-z0-9]/g, '').toUpperCase();

  const cpfValido = cpfLimpo.length === 11;
  const placaValida = placaLimpa.length >= 7;
  const podeBuscar = enabled && (cpfValido || placaValida);
  const origem: 'cpf' | 'placa' = cpfValido ? 'cpf' : 'placa';

  return useQuery<SgaAssociadoCompleto>({
    queryKey: ['sga-busca', cpfValido ? cpfLimpo : '', placaValida ? placaLimpa : ''],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('sga-buscar-associado-completo', {
        body: cpfValido ? { cpf: cpfLimpo } : { placa: placaLimpa },
      });
      if (error) {
        console.warn('[useBuscaSGA] invoke error → tratando como transitório:', error.message);
        throw new SgaTransientFetchError({
          ...empty(origem),
          erro_transitorio: true,
          motivo: 'invoke_error',
        });
      }
      const payload = (data as SgaAssociadoCompleto) ?? empty(origem);
      if (payload.erro_transitorio) {
        // Lança para acionar retry policy do React Query.
        throw new SgaTransientFetchError(payload);
      }
      return payload;
    },
    enabled: podeBuscar,
    staleTime: 30_000,
    gcTime: 2 * 60_000,
    // Retry só faz sentido para erros transitórios; nosso erro carrega o payload.
    retry: (failureCount, err) => err instanceof SgaTransientFetchError && failureCount < 3,
    retryDelay: (attempt) => Math.min(2000 * 2 ** attempt, 10_000),
    // Quando estoura o retry, o React Query expõe o último erro. Convertemos ele
    // em `data` "soft" via `select` no consumidor — aqui só fornecemos um helper:
    // o hook `useBuscaSGA` consumido normalmente lê `data` ou, em erro persistente,
    // o consumidor pode ler o payload via `error`.
  });
}

/**
 * Helper para extrair o payload "soft" (com erro_transitorio) mesmo quando o
 * React Query falhou todas as tentativas. Os wrappers (`useBuscaPlaca`,
 * `useVerificarVeiculoAtivoCpf`, `useVerificarVeiculoSGA`) usam isso para nunca
 * devolver "data: null" quando a falha for transitória — o consumidor recebe
 * `{...empty, erro_transitorio: true}` e pode renderizar o banner âmbar.
 */
export function extractTransientPayload(error: unknown): SgaAssociadoCompleto | null {
  if (error instanceof SgaTransientFetchError) return error.payload;
  return null;
}
