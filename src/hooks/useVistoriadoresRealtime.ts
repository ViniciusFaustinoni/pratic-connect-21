import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEffect } from "react";
import { subMinutes } from "date-fns";
import { StatusOperacional } from "./useEquipe";

export interface VistoriadorLocalizacao {
  vistoriador_id: string;
  vistoriador_nome: string;
  latitude: number;
  longitude: number;
  em_servico: boolean;
  updated_at: string;
  telefone: string | null;
  status_operacional: StatusOperacional;
}

export function useVistoriadoresRealtime() {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['vistoriadores-localizacao-realtime'],
    queryFn: async (): Promise<VistoriadorLocalizacao[]> => {
      const cutoffTime = subMinutes(new Date(), 60).toISOString();
      
      const { data, error } = await supabase
        .from('vistoriadores_localizacao')
        .select(`
          vistoriador_id,
          latitude,
          longitude,
          em_servico,
          updated_at,
          profiles:vistoriador_id (
            nome,
            telefone
          )
        `)
        .gte('updated_at', cutoffTime)
        .eq('em_servico', true);

      if (error) {
        console.error('Erro ao buscar localização dos vistoriadores:', error);
        throw error;
      }

      if (!data?.length) return [];

      // Buscar tarefas ativas dos profissionais para determinar status operacional
      const profissionalIds = data.map((item: any) => item.vistoriador_id);
      const { data: tarefasAtivas } = await supabase
        .from('servicos')
        .select('profissional_id, status, contato_realizado_em')
        .in('profissional_id', profissionalIds)
        .in('status', ['em_rota', 'em_andamento', 'agendada']);

      const tarefaPorProfissional: Record<string, { status: string; contato_realizado_em: string | null }> = {};
      tarefasAtivas?.forEach(t => {
        if (t.profissional_id) {
          const existente = tarefaPorProfissional[t.profissional_id];
          const prioridade = (s: string) => s === 'em_andamento' ? 1 : s === 'em_rota' ? 2 : 3;
          if (!existente || prioridade(t.status) < prioridade(existente.status)) {
            tarefaPorProfissional[t.profissional_id] = {
              status: t.status,
              contato_realizado_em: t.contato_realizado_em,
            };
          }
        }
      });

      const LIMITE_INATIVIDADE_MS = 15 * 60 * 1000; // 15 minutos
      const agoraMs = Date.now();

      return data.map((item: any) => {
        const tarefa = tarefaPorProfissional[item.vistoriador_id];
        const updatedAt = new Date(item.updated_at).getTime();
        const estaInativo = agoraMs - updatedAt > LIMITE_INATIVIDADE_MS;

        let status_operacional: StatusOperacional = 'disponivel_operacional';
        if (estaInativo) {
          status_operacional = 'offline';
        } else if (tarefa?.status === 'em_andamento') {
          status_operacional = 'em_andamento';
        } else if (tarefa?.status === 'em_rota') {
          status_operacional = 'em_rota';
        } else if (tarefa?.status === 'agendada' && tarefa?.contato_realizado_em) {
          status_operacional = 'em_contato';
        }

        return {
          vistoriador_id: item.vistoriador_id,
          vistoriador_nome: item.profiles?.nome || 'Vistoriador',
          latitude: item.latitude,
          longitude: item.longitude,
          em_servico: item.em_servico,
          updated_at: item.updated_at,
          telefone: item.profiles?.telefone || null,
          status_operacional,
        };
      });
    },
    
  });

  // Supabase Realtime para atualizações instantâneas
  useEffect(() => {
    const channel = supabase
      .channel('vistoriadores-localizacao-realtime-channel')
      .on(
        'postgres_changes',
        { 
          event: '*', 
          schema: 'public', 
          table: 'vistoriadores_localizacao' 
        },
        (payload) => {
          console.log('Atualização de localização recebida:', payload);
          queryClient.invalidateQueries({ 
            queryKey: ['vistoriadores-localizacao-realtime'] 
          });
        }
      )
      .subscribe((status) => {
        console.log('Status da subscription realtime:', status);
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  return query;
}
