import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface SgaVeiculoSnapshot {
  placa: string | null;
  chassi: string | null;
  marca: string | null;
  modelo: string | null;
  ano_fabricacao: string | null;
  ano_modelo: string | null;
  valor_fipe: number | null;
  codigo_fipe: string | null;
  codigo_veiculo: number | null;
  codigo_situacao: string | null;
  descricao_situacao: string | null;
  renavam: string | null;
  codigo_cor: string | null;
  codigo_combustivel: string | null;
}

export interface SgaAssociadoSnapshot {
  codigo_associado: number | null;
  nome: string | null;
  cpf: string | null;
  email: string | null;
  telefone_celular: string | null;
  telefone_fixo: string | null;
  logradouro: string | null;
  numero: string | null;
  complemento: string | null;
  bairro: string | null;
  cidade: string | null;
  estado: string | null;
  cep: string | null;
  data_nascimento: string | null;
  dia_vencimento: string | null;
  descricao_situacao: string | null;
}

export interface SgaVeiculoAssociadoResponse {
  encontrado: boolean;
  veiculo: SgaVeiculoSnapshot | null;
  associado: SgaAssociadoSnapshot | null;
  erro_transitorio?: boolean;
  motivo?: string;
}

export function useSgaVeiculoAssociado(placa: string, enabled = true) {
  const placaLimpa = (placa || '').replace(/[^A-Za-z0-9]/g, '').toUpperCase();
  return useQuery({
    queryKey: ['sga-veiculo-associado', placaLimpa],
    enabled: enabled && placaLimpa.length >= 7,
    staleTime: 60_000,
    queryFn: async (): Promise<SgaVeiculoAssociadoResponse> => {
      const { data, error } = await supabase.functions.invoke('sga-buscar-veiculo-associado', {
        body: { placa: placaLimpa },
      });
      if (error) throw error;
      return data as SgaVeiculoAssociadoResponse;
    },
  });
}
