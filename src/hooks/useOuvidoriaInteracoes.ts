import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Interacao, IALog, Anexo } from "@/types/ouvidoria";

// Hook para listar interações de uma manifestação
export function useInteracoes(manifestacaoId: string | undefined) {
  return useQuery({
    queryKey: ["ouvidoria", "interacoes", manifestacaoId],
    queryFn: async () => {
      if (!manifestacaoId) return [];

      const { data, error } = await supabase
        .from("ouvidoria_interacoes")
        .select(`
          *,
          usuario:profiles(id, nome)
        `)
        .eq("manifestacao_id", manifestacaoId)
        .order("created_at", { ascending: true });

      if (error) throw error;
      return data as Interacao[];
    },
    enabled: !!manifestacaoId,
  });
}

// Hook para listar logs de IA de uma manifestação
export function useIALogs(manifestacaoId: string | undefined) {
  return useQuery({
    queryKey: ["ouvidoria", "ia_logs", manifestacaoId],
    queryFn: async () => {
      if (!manifestacaoId) return [];

      const { data, error } = await supabase
        .from("ouvidoria_ia_logs")
        .select("*")
        .eq("manifestacao_id", manifestacaoId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as IALog[];
    },
    enabled: !!manifestacaoId,
  });
}

// Hook para listar anexos de uma manifestação
export function useAnexos(manifestacaoId: string | undefined) {
  return useQuery({
    queryKey: ["ouvidoria", "anexos", manifestacaoId],
    queryFn: async () => {
      if (!manifestacaoId) return [];

      const { data, error } = await supabase
        .from("ouvidoria_anexos")
        .select("*")
        .eq("manifestacao_id", manifestacaoId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as Anexo[];
    },
    enabled: !!manifestacaoId,
  });
}
