import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface SoftruckEvento {
  id: string;
  evento_tipo: string;
  evento_acao: string | null;
  payload: Record<string, unknown>;
  device_id: string | null;
  vehicle_id: string | null;
  imei: string | null;
  placa: string | null;
  rastreador_id: string | null;
  veiculo_id: string | null;
  processado: boolean;
  processado_em: string | null;
  erro_processamento: string | null;
  alerta_gerado: boolean;
  alerta_id: string | null;
  ip_origem: string | null;
  headers_recebidos: Record<string, unknown> | null;
  created_at: string;
}

interface UseSoftruckEventosParams {
  limite?: number;
  apenasNaoProcessados?: boolean;
  tipoEvento?: string;
}

export function useSoftruckEventos(params: UseSoftruckEventosParams = {}) {
  const { limite = 50, apenasNaoProcessados = false, tipoEvento } = params;

  return useQuery({
    queryKey: ["softruck-eventos", { limite, apenasNaoProcessados, tipoEvento }],
    queryFn: async () => {
      let query = supabase
        .from("softruck_eventos")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(limite);

      if (apenasNaoProcessados) {
        query = query.eq("processado", false);
      }

      if (tipoEvento) {
        query = query.eq("evento_tipo", tipoEvento);
      }

      const { data, error } = await query;

      if (error) throw error;
      return data as SoftruckEvento[];
    },
  });
}

export function useSoftruckEventosPorRastreador(rastreadorId: string | null) {
  return useQuery({
    queryKey: ["softruck-eventos", "rastreador", rastreadorId],
    queryFn: async () => {
      if (!rastreadorId) return [];

      const { data, error } = await supabase
        .from("softruck_eventos")
        .select("*")
        .eq("rastreador_id", rastreadorId)
        .order("created_at", { ascending: false })
        .limit(20);

      if (error) throw error;
      return data as SoftruckEvento[];
    },
    enabled: !!rastreadorId,
  });
}

export function useReprocessarEvento() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (eventoId: string) => {
      // Get the event
      const { data: evento, error: fetchError } = await supabase
        .from("softruck_eventos")
        .select("*")
        .eq("id", eventoId)
        .single();

      if (fetchError) throw fetchError;

      // Re-invoke the webhook with the same payload
      const payloadData = evento.payload as Record<string, unknown>;
      const { data, error } = await supabase.functions.invoke("softruck-webhook", {
        body: payloadData,
      });

      if (error) throw error;

      // Mark original as processed
      await supabase
        .from("softruck_eventos")
        .update({
          processado: true,
          processado_em: new Date().toISOString(),
          erro_processamento: null,
        })
        .eq("id", eventoId);

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["softruck-eventos"] });
    },
  });
}

export function useEstatisticasWebhooks() {
  return useQuery({
    queryKey: ["softruck-eventos", "estatisticas"],
    queryFn: async () => {
      // Get counts by type and status
      const { data: total, error: totalError } = await supabase
        .from("softruck_eventos")
        .select("id", { count: "exact", head: true });

      const { data: processados, error: procError } = await supabase
        .from("softruck_eventos")
        .select("id", { count: "exact", head: true })
        .eq("processado", true);

      const { data: erros, error: errosError } = await supabase
        .from("softruck_eventos")
        .select("id", { count: "exact", head: true })
        .not("erro_processamento", "is", null);

      const { data: alertas, error: alertasError } = await supabase
        .from("softruck_eventos")
        .select("id", { count: "exact", head: true })
        .eq("alerta_gerado", true);

      if (totalError || procError || errosError || alertasError) {
        throw totalError || procError || errosError || alertasError;
      }

      // Get last 24h events
      const ontem = new Date();
      ontem.setHours(ontem.getHours() - 24);

      const { data: ultimas24h, error: ultError } = await supabase
        .from("softruck_eventos")
        .select("id", { count: "exact", head: true })
        .gte("created_at", ontem.toISOString());

      return {
        total: (total as unknown as { count: number })?.count || 0,
        processados: (processados as unknown as { count: number })?.count || 0,
        erros: (erros as unknown as { count: number })?.count || 0,
        alertasGerados: (alertas as unknown as { count: number })?.count || 0,
        ultimas24h: (ultimas24h as unknown as { count: number })?.count || 0,
      };
    },
  });
}
