import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { differenceInDays } from 'date-fns';
import type { StatusSinistro } from '@/types/sinistros';

export const SLA_POR_STATUS: Record<string, number> = {
  comunicado: 3,
  documentacao_pendente: 30,
  aguardando_vistoria: 7,
  em_vistoria: 5,
  aguardando_parecer: 5,
  em_analise: 7,
  aguardando_analise: 3,
  em_sindicancia: 30,
  em_pericia: 15,
  analise_interna: 7,
  suspenso: 30,
  aguardando_diretoria: 5,
  aguardando_juridico: 10,
  aprovado: 5,
  aguardando_cota: 30,
  aguardando_termo: 30,
  em_reparo: 90,
  em_recuperacao: 30,
  em_regulacao: 10,
  em_garantia: 30,
  aguardando_confirmacoes: 5,
  pronto_para_oficina: 5,
  em_oficina: 90,
  aguardando_peca: 30,
  em_finalizacao: 5,
  aguardando_pagamento: 10,
  aguardando_indenizacao: 10,
};

const STATUS_FINAIS = [
  'encerrado', 'cancelado', 'pago', 'negado', 'indenizado',
  'finalizado', 'concluido', 'entregue', 'pagamento_confirmado', 'reprovado',
];

export interface SinistroSLA {
  id: string;
  protocolo: string;
  status: string;
  tipo: string;
  updated_at: string;
  created_at: string;
  associado: { id: string; nome: string; cpf: string } | null;
  veiculo: { id: string; placa: string; marca: string; modelo: string } | null;
  diasNaEtapa: number;
  slaDaEtapa: number;
  percentual: number;
  classificacao: 'verde' | 'amarelo' | 'vermelho';
}

export interface SLAKpis {
  dentroDoSla: number;
  proximoVencimento: number;
  slaEstourado: number;
  tempoMedio: number;
}

function classificar(percentual: number): 'verde' | 'amarelo' | 'vermelho' {
  if (percentual <= 60) return 'verde';
  if (percentual <= 100) return 'amarelo';
  return 'vermelho';
}

export function useEventosSLA(filters?: {
  status?: string;
  tipo?: string;
  apenasVencidos?: boolean;
  busca?: string;
}) {
  return useQuery({
    queryKey: ['eventos-sla', filters],
    queryFn: async () => {
      let query = supabase
        .from('sinistros')
        .select(`
          id, protocolo, status, tipo, updated_at, created_at,
          associado:associados(id, nome, cpf),
          veiculo:veiculos(id, placa, marca, modelo)
        `)
        .not('status', 'in', `(${STATUS_FINAIS.join(',')})`)
        .order('updated_at', { ascending: true });

      if (filters?.status && filters.status !== 'todos') {
        query = query.eq('status', filters.status as any);
      }
      if (filters?.tipo && filters.tipo !== 'todos') {
        query = query.eq('tipo', filters.tipo as any);
      }
      if (filters?.busca) {
        query = query.or(`protocolo.ilike.%${filters.busca}%`);
      }

      const { data, error } = await query;
      if (error) throw error;

      const sinistros: SinistroSLA[] = (data || []).map((s: any) => {
        const diasNaEtapa = differenceInDays(new Date(), new Date(s.updated_at));
        const slaDaEtapa = SLA_POR_STATUS[s.status] || 30;
        const percentual = slaDaEtapa > 0 ? (diasNaEtapa / slaDaEtapa) * 100 : 0;
        return {
          ...s,
          diasNaEtapa,
          slaDaEtapa,
          percentual,
          classificacao: classificar(percentual),
        };
      });

      // Filtro de apenas vencidos
      const filtered = filters?.apenasVencidos
        ? sinistros.filter(s => s.classificacao === 'vermelho')
        : sinistros;

      // Ordenar por mais crítico primeiro
      filtered.sort((a, b) => b.percentual - a.percentual);

      // KPIs
      const kpis: SLAKpis = {
        dentroDoSla: sinistros.filter(s => s.classificacao === 'verde').length,
        proximoVencimento: sinistros.filter(s => s.classificacao === 'amarelo').length,
        slaEstourado: sinistros.filter(s => s.classificacao === 'vermelho').length,
        tempoMedio: sinistros.length > 0
          ? Math.round(sinistros.reduce((acc, s) => acc + s.diasNaEtapa, 0) / sinistros.length)
          : 0,
      };

      // Distribuição por fase
      const distribuicao: Record<string, { dentro: number; proximo: number; estourado: number }> = {};
      for (const s of sinistros) {
        if (!distribuicao[s.status]) {
          distribuicao[s.status] = { dentro: 0, proximo: 0, estourado: 0 };
        }
        if (s.classificacao === 'verde') distribuicao[s.status].dentro++;
        else if (s.classificacao === 'amarelo') distribuicao[s.status].proximo++;
        else distribuicao[s.status].estourado++;
      }

      return { sinistros: filtered, kpis, distribuicao };
    },
  });
}

export function useSinistroHistoricoTransicoes(sinistroId: string | null) {
  return useQuery({
    queryKey: ['sinistro-historico-transicoes', sinistroId],
    queryFn: async () => {
      if (!sinistroId) return [];
      const { data, error } = await supabase
        .from('sinistro_historico')
        .select('*')
        .eq('sinistro_id', sinistroId)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return data || [];
    },
    enabled: !!sinistroId,
  });
}
