import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface VeiculoAtivoCpfResult {
  associado_id: string;
  associado_nome: string;
  veiculo_id: string;
  veiculo_placa: string;
  veiculo_modelo: string;
  veiculo_marca: string;
}

/**
 * Verifica se um CPF já possui veículo ativo na Praticcar.
 * Retorna dados do associado + veículo ativo, ou null.
 */
export function useVerificarVeiculoAtivoCpf(cpf: string | undefined) {
  const cpfLimpo = cpf?.replace(/\D/g, '') || '';

  return useQuery<VeiculoAtivoCpfResult | null>({
    queryKey: ['verificar-veiculo-ativo-cpf', cpfLimpo],
    queryFn: async () => {
      if (cpfLimpo.length !== 11) return null;

      // Buscar associado pelo CPF
      const { data: associado } = await supabase
        .from('associados')
        .select('id, nome, cpf')
        .eq('cpf', cpfLimpo)
        .eq('status', 'ativo')
        .maybeSingle();

      if (!associado) return null;

      // Buscar veículo ativo desse associado
      const { data: veiculo } = await supabase
        .from('veiculos')
        .select('id, placa, modelo, marca')
        .eq('associado_id', associado.id)
        .eq('ativo', true)
        .limit(1)
        .maybeSingle();

      if (!veiculo) return null;

      return {
        associado_id: associado.id,
        associado_nome: associado.nome,
        veiculo_id: veiculo.id,
        veiculo_placa: veiculo.placa || '',
        veiculo_modelo: veiculo.modelo || '',
        veiculo_marca: veiculo.marca || '',
      };
    },
    enabled: cpfLimpo.length === 11,
    staleTime: 30_000,
  });
}
