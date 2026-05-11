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

export interface AnalisePreviaResultado {
  do_cache?: boolean;
  gerado_em?: string;
  base_local?: {
    encontrado?: boolean;
    associado?: { id: string; nome: string; cpf: string; email?: string; telefone?: string; status?: string; created_at?: string };
    erro?: string;
  };
  sga?: {
    encontrado: boolean;
    codigo_associado?: number | null;
    associado?: { nome: string | null; cpf: string | null; email: string | null; telefone: string | null } | null;
    veiculos?: VeiculoSGA[];
    saldo_devedor_total?: number;
    tem_debito?: boolean;
    erro_transitorio?: boolean;
    motivo?: string;
    erro?: string;
  };
}

export function useAnalisePreviaSGA(solicitacaoId: string | null | undefined, enabled: boolean) {
  return useQuery({
    queryKey: ['analise-previa-sga', solicitacaoId],
    enabled: !!solicitacaoId && enabled,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
    queryFn: async (): Promise<AnalisePreviaResultado> => {
      const { data, error } = await supabase.functions.invoke('analisar-novo-titular-troca', {
        body: { solicitacao_id: solicitacaoId },
      });
      if (error) throw error;
      return data as AnalisePreviaResultado;
    },
  });
}

export async function forcarAtualizarAnalisePrevia(solicitacaoId: string) {
  const { data, error } = await supabase.functions.invoke('analisar-novo-titular-troca', {
    body: { solicitacao_id: solicitacaoId, force: true },
  });
  if (error) throw error;
  return data as AnalisePreviaResultado;
}
