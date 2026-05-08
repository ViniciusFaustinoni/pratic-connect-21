import { useMutation } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface PlacaOutroAssociadoInfo {
  conflito: boolean;
  /** True quando a placa já existe sob o MESMO CPF do solicitante (sugerir Inclusão de Veículo) */
  mesmoTitular?: boolean;
  associadoId?: string;
  associadoNome?: string;
  cpfMascarado?: string;
  status?: string | null;
  veiculoId?: string;
}

const normalizarPlaca = (p: string) => p.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
const onlyDigits = (s: string) => (s || '').replace(/\D/g, '');

const mascararCpf = (cpf: string): string => {
  const d = onlyDigits(cpf);
  if (d.length !== 11) return cpf;
  return `***.${d.slice(3, 6)}.***-${d.slice(9)}`;
};

/**
 * Verifica se a placa já está vinculada a um veículo de OUTRO associado
 * na base local. Detecta colisão antes da geração do contrato.
 *
 * - cpfSolicitante opcional: se informado e bater com o dono atual,
 *   retorna `mesmoTitular: true` (sugerir Inclusão de Veículo).
 */
export function useVerificarPlacaOutroAssociado() {
  return useMutation({
    mutationFn: async (params: {
      placa: string;
      cpfSolicitante?: string | null;
    }): Promise<PlacaOutroAssociadoInfo | null> => {
      const placa = normalizarPlaca(params.placa || '');
      if (!placa || placa.length < 7) return null;

      const { data, error } = await supabase
        .from('veiculos')
        .select('id, associado_id, associados:associado_id(id, nome, cpf, status)')
        .eq('placa', placa)
        .maybeSingle();

      if (error) {
        console.warn('[useVerificarPlacaOutroAssociado] erro:', error.message);
        return null;
      }
      if (!data || !data.associado_id) return null;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const assoc = (data as any).associados as
        | { id: string; nome: string | null; cpf: string | null; status: string | null }
        | null;
      if (!assoc) return null;

      const cpfDono = onlyDigits(assoc.cpf || '');
      const cpfSolic = onlyDigits(params.cpfSolicitante || '');

      if (cpfSolic && cpfDono && cpfSolic === cpfDono) {
        return {
          conflito: false,
          mesmoTitular: true,
          associadoId: assoc.id,
          associadoNome: assoc.nome || undefined,
          status: assoc.status,
          veiculoId: data.id,
        };
      }

      return {
        conflito: true,
        associadoId: assoc.id,
        associadoNome: assoc.nome || 'Associado',
        cpfMascarado: assoc.cpf ? mascararCpf(assoc.cpf) : '***',
        status: assoc.status,
        veiculoId: data.id,
      };
    },
  });
}
