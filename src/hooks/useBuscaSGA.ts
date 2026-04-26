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
 * Hook central que consulta o SGA (Hinova) durante o fluxo de cotação.
 * Substitui as queries diretas em `associados`/`veiculos`/`cobrancas` locais.
 *
 * Retorna {encontrado, codigo_associado, associado, veiculos[], saldo_devedor_total,
 *          tem_debito, boletos_abertos por veículo}.
 */
export function useBuscaSGA({ cpf, placa, enabled = true }: BuscaInput) {
  const cpfLimpo = (cpf || '').replace(/\D/g, '');
  const placaLimpa = (placa || '').replace(/[^A-Za-z0-9]/g, '').toUpperCase();

  const cpfValido = cpfLimpo.length === 11;
  const placaValida = placaLimpa.length >= 7;
  const podeBuscar = enabled && (cpfValido || placaValida);

  return useQuery<SgaAssociadoCompleto>({
    queryKey: ['sga-busca', cpfValido ? cpfLimpo : '', placaValida ? placaLimpa : ''],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('sga-buscar-associado-completo', {
        body: cpfValido ? { cpf: cpfLimpo } : { placa: placaLimpa },
      });
      if (error) {
        console.error('[useBuscaSGA] erro:', error);
        return empty(cpfValido ? 'cpf' : 'placa');
      }
      return (data as SgaAssociadoCompleto) ?? empty(cpfValido ? 'cpf' : 'placa');
    },
    enabled: podeBuscar,
    staleTime: 30_000,
    gcTime: 2 * 60_000,
    retry: 1,
  });
}
