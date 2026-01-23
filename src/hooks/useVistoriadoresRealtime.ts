import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEffect } from "react";
import { subMinutes } from "date-fns";

export interface VistoriadorLocalizacao {
  vistoriador_id: string;
  vistoriador_nome: string;
  latitude: number;
  longitude: number;
  em_servico: boolean;
  updated_at: string;
  telefone: string | null;
}

export function useVistoriadoresRealtime() {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['vistoriadores-localizacao-realtime'],
    queryFn: async (): Promise<VistoriadorLocalizacao[]> => {
      // Buscar apenas vistoriadores com localização atualizada nos últimos 60 minutos
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

      // Transformar dados para o formato esperado
      return (data || []).map((item: any) => ({
        vistoriador_id: item.vistoriador_id,
        vistoriador_nome: item.profiles?.nome || 'Vistoriador',
        latitude: item.latitude,
        longitude: item.longitude,
        em_servico: item.em_servico,
        updated_at: item.updated_at,
        telefone: item.profiles?.telefone || null,
      }));
    },
    refetchInterval: 30000, // Fallback: refetch a cada 30 segundos
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
          // Invalidar cache para recarregar dados
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
