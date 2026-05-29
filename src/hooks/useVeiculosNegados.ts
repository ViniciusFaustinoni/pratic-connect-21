import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

/**
 * Hook canônico da aba "Negados" em Serviços de Campo.
 *
 * Lista veículos com `veiculos.status = 'recusado'` — sinal canônico de negação
 * escrito por `useAprovacaoMonitoramento.handleReprovar` (Monitoramento), por
 * recusa do instalador/vistoriador e pelo Cadastro. Mutuamente exclusivo das
 * abas Suspensos (instalacao_pendente) e Atribuição Manual (pendente/agendada).
 *
 * A cascata de cancelamento dos serviços ativos é garantida pela trigger DB
 * `trg_cascata_negacao_veiculo`.
 */

export interface ServicoHistoricoNegado {
  id: string;
  tipo: string;
  status: string;
  data_agendada: string | null;
  observacoes: string | null;
  profissional_nome: string | null;
  motivo_reprovacao: string | null;
  updated_at: string;
}

export interface VeiculoNegado {
  id: string;
  placa: string;
  marca: string | null;
  modelo: string | null;
  ano: number | null;
  motivo_recusa_veiculo: string | null;
  recusado_em: string | null;
  recusado_por_nome: string | null;
  associado_id: string | null;
  associado_nome: string | null;
  associado_cpf: string | null;
  contrato_id: string | null;
  servicos_anteriores: ServicoHistoricoNegado[];
  total_servicos: number;
}

export function useVeiculosNegados() {
  return useQuery({
    queryKey: ['veiculos-negados'],
    queryFn: async (): Promise<VeiculoNegado[]> => {
      const { data: veiculos, error } = await supabase
        .from('veiculos')
        .select(`
          id, placa, marca, modelo,
          motivo_recusa_veiculo, updated_at,
          associado_id,
          associado:associados(nome, cpf)
        `)
        .eq('status', 'recusado')
        .order('updated_at', { ascending: false });

      if (error) throw error;
      if (!veiculos || veiculos.length === 0) return [];

      const veiculoIds = veiculos.map((v) => v.id);

      // Serviços históricos por veículo (todos os tipos)
      const { data: servicos } = await supabase
        .from('servicos')
        .select(`
          id, tipo, status, data_agendada, observacoes,
          motivo_reprovacao, profissional_id, veiculo_id, updated_at,
          profissional:profiles!servicos_profissional_id_fkey(nome)
        `)
        .in('veiculo_id', veiculoIds)
        .order('updated_at', { ascending: false });

      // Contrato vinculado mais recente por veículo
      const { data: contratos } = await supabase
        .from('contratos')
        .select('id, veiculo_id, created_at')
        .in('veiculo_id', veiculoIds)
        .order('created_at', { ascending: false });

      const contratoPorVeiculo = new Map<string, string>();
      (contratos ?? []).forEach((c: any) => {
        if (!contratoPorVeiculo.has(c.veiculo_id)) {
          contratoPorVeiculo.set(c.veiculo_id, c.id);
        }
      });

      // Log de auditoria mais recente "[VEICULO_NEGADO]" por veículo (quem negou)
      const { data: logs } = await supabase
        .from('logs_auditoria')
        .select('registro_id, usuario_id, created_at, descricao')
        .eq('tabela', 'veiculos')
        .in('registro_id', veiculoIds)
        .ilike('descricao', '[VEICULO_NEGADO]%')
        .order('created_at', { ascending: false });

      const userIds = Array.from(new Set((logs ?? []).map((l: any) => l.usuario_id).filter(Boolean)));
      const { data: profiles } = userIds.length
        ? await supabase.from('profiles').select('id, nome').in('id', userIds as string[])
        : { data: [] as any[] };
      const nomePorProfile = new Map<string, string>(
        (profiles ?? []).map((p: any) => [p.id, p.nome])
      );

      const logPorVeiculo = new Map<string, { recusado_em: string; recusado_por_nome: string | null }>();
      (logs ?? []).forEach((l: any) => {
        if (!logPorVeiculo.has(l.registro_id)) {
          logPorVeiculo.set(l.registro_id, {
            recusado_em: l.created_at,
            recusado_por_nome: l.usuario_id ? nomePorProfile.get(l.usuario_id) ?? null : null,
          });
        }
      });

      const servicosPorVeiculo = new Map<string, ServicoHistoricoNegado[]>();
      (servicos ?? []).forEach((s: any) => {
        const list = servicosPorVeiculo.get(s.veiculo_id) ?? [];
        list.push({
          id: s.id,
          tipo: s.tipo,
          status: s.status,
          data_agendada: s.data_agendada,
          observacoes: s.observacoes,
          profissional_nome: s.profissional?.nome ?? null,
          motivo_reprovacao: s.motivo_reprovacao,
          updated_at: s.updated_at,
        });
        servicosPorVeiculo.set(s.veiculo_id, list);
      });

      return veiculos.map((v: any) => {
        const log = logPorVeiculo.get(v.id);
        const hist = servicosPorVeiculo.get(v.id) ?? [];
        return {
          id: v.id,
          placa: v.placa,
          marca: v.marca,
          modelo: v.modelo,
          ano: null,
          motivo_recusa_veiculo: v.motivo_recusa_veiculo,
          recusado_em: log?.recusado_em ?? v.updated_at,
          recusado_por_nome: log?.recusado_por_nome ?? null,
          associado_id: v.associado_id,
          associado_nome: v.associado?.nome ?? null,
          associado_cpf: v.associado?.cpf ?? null,
          contrato_id: contratoPorVeiculo.get(v.id) ?? null,
          servicos_anteriores: hist,
          total_servicos: hist.length,
        };
      });
    },
    staleTime: 30_000,
  });
}
