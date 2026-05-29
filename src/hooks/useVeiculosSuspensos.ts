import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

/**
 * Hook canônico da aba "Veículos Suspensos" em Serviços de Campo.
 *
 * Lista veículos cuja cobertura foi suspensa AUTOMATICAMENTE por falta de
 * instalação no prazo (48h/72h após assinatura/agendamento, recusa do
 * instalador, "não instalou no prazo"). NÃO inclui suspensões por sub-FIPE
 * autovistoria incompleta, inadimplência ou ações manuais avulsas.
 *
 * Também devolve, quando existir, o serviço de instalação aberto vinculado
 * ao veículo (para o Coordenador reusar a execução interna em vez de criar
 * um novo).
 */
export interface VeiculoSuspenso {
  id: string;
  placa: string;
  modelo: string | null;
  marca: string | null;
  cobertura_suspensa_motivo: string | null;
  cobertura_suspensa_em: string | null;
  contrato_id: string | null;
  associado_id: string | null;
  associado_nome: string | null;
  associado_cpf: string | null;
  servico_aberto: {
    id: string;
    tipo: string;
    status: string;
    data_agendada: string;
  } | null;
  dias_suspenso: number;
}

const MOTIVO_PATTERNS = [
  'não realizada',
  'nao realizada',
  'não instalou',
  'nao instalou',
  'Recusa do instalador',
];

export function useVeiculosSuspensos() {
  return useQuery({
    queryKey: ['veiculos-suspensos-instalacao'],
    queryFn: async (): Promise<VeiculoSuspenso[]> => {
      // OR de ILIKE pra todos os padrões de motivo de não-instalação
      const orFilter = MOTIVO_PATTERNS.map(
        (p) => `cobertura_suspensa_motivo.ilike.%${p}%`,
      ).join(',');

      const { data: veiculos, error } = await supabase
        .from('veiculos')
        .select(
          `
          id, placa, modelo, marca,
          cobertura_suspensa_motivo, cobertura_suspensa_em,
          associado_id, status,
          associado:associados(nome, cpf)
        `,
        )
        .eq('cobertura_suspensa', true)
        // Exclui cancelados E negados: 'recusado' pertence à aba "Negados"
        .not('status', 'in', '(cancelado,recusado)')
        .or(orFilter)
        .order('cobertura_suspensa_em', { ascending: true });

      if (error) throw error;
      if (!veiculos || veiculos.length === 0) return [];

      const ids = veiculos.map((v) => v.id);
      const { data: servicos } = await supabase
        .from('servicos')
        .select('id, tipo, status, data_agendada, veiculo_id')
        .in('veiculo_id', ids)
        .in('tipo', ['instalacao', 'vistoria_entrada'])
        .not('status', 'in', '(concluida,aprovada,reprovada,aprovada_ressalvas,cancelada)')
        .order('created_at', { ascending: false });

      const servicoPorVeiculo = new Map<string, any>();
      (servicos ?? []).forEach((s) => {
        if (!servicoPorVeiculo.has(s.veiculo_id!)) {
          servicoPorVeiculo.set(s.veiculo_id!, s);
        }
      });

      const agora = Date.now();
      return veiculos.map((v: any) => {
        const sv = servicoPorVeiculo.get(v.id) ?? null;
        const susp = v.cobertura_suspensa_em
          ? Math.floor((agora - new Date(v.cobertura_suspensa_em).getTime()) / 86_400_000)
          : 0;
        return {
          id: v.id,
          placa: v.placa,
          modelo: v.modelo,
          marca: v.marca,
          cobertura_suspensa_motivo: v.cobertura_suspensa_motivo,
          cobertura_suspensa_em: v.cobertura_suspensa_em,
          contrato_id: null,
          associado_id: v.associado_id,
          associado_nome: v.associado?.nome ?? null,
          associado_cpf: v.associado?.cpf ?? null,
          servico_aberto: sv
            ? { id: sv.id, tipo: sv.tipo, status: sv.status, data_agendada: sv.data_agendada }
            : null,
          dias_suspenso: susp,
        };
      });
    },
    staleTime: 30_000,
  });
}
