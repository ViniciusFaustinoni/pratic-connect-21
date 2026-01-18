import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface AlertaAuditoria {
  id: string;
  vendedor_id: string;
  tipo_alerta: string;
  descricao: string;
  dados: Record<string, any> | null;
  score_risco: number;
  status: "pendente" | "analisado" | "ignorado" | "confirmado";
  analisado_por: string | null;
  analisado_em: string | null;
  observacoes_analise: string | null;
  created_at: string;
  vendedor?: {
    id: string;
    nome: string;
    avatar_url: string | null;
  };
}

export interface VendedorMonitoramento {
  id: string;
  vendedor_id: string;
  status_monitoramento: "normal" | "sob_observacao" | "suspenso";
  motivo: string | null;
  score_risco_acumulado: number;
  total_alertas: number;
  alertas_confirmados: number;
  ultima_analise: string | null;
  analisado_por: string | null;
  observacoes: string | null;
  created_at: string;
  updated_at: string;
  vendedor?: {
    id: string;
    nome: string;
    avatar_url: string | null;
  };
}

export interface MetricasVendedor {
  vendedor_id: string;
  vendedor_nome: string;
  total_leads: number;
  leads_ganhos: number;
  leads_perdidos: number;
  leads_em_andamento: number;
  taxa_conversao: number;
  taxa_perda: number;
  total_cotacoes: number;
  cotacoes_aceitas: number;
  cotacoes_abandonadas: number;
  status_monitoramento: string | null;
  score_risco_acumulado: number | null;
}

export interface CPFDuplicado {
  cpf: string;
  qtd_vendedores: number;
  vendedores_ids: string[];
  nomes_usados: string[];
  total_leads: number;
  ultimo_lead: string;
}

// Hook para buscar alertas pendentes
export function useAlertasPendentes() {
  return useQuery({
    queryKey: ["auditoria-alertas-pendentes"],
    queryFn: async (): Promise<AlertaAuditoria[]> => {
      const { data, error } = await supabase
        .from("auditoria_vendedores")
        .select(`
          *,
          vendedor:profiles!auditoria_vendedores_vendedor_id_fkey(id, nome, avatar_url)
        `)
        .eq("status", "pendente")
        .order("score_risco", { ascending: false })
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as AlertaAuditoria[];
    },
  });
}

// Hook para buscar todos os alertas com filtros
export function useAlertasAuditoria(options?: {
  status?: string;
  tipoAlerta?: string;
  vendedorId?: string;
  limit?: number;
}) {
  return useQuery({
    queryKey: ["auditoria-alertas", options],
    queryFn: async (): Promise<AlertaAuditoria[]> => {
      let query = supabase
        .from("auditoria_vendedores")
        .select(`
          *,
          vendedor:profiles!auditoria_vendedores_vendedor_id_fkey(id, nome, avatar_url)
        `)
        .order("created_at", { ascending: false });

      if (options?.status) {
        query = query.eq("status", options.status);
      }
      if (options?.tipoAlerta) {
        query = query.eq("tipo_alerta", options.tipoAlerta);
      }
      if (options?.vendedorId) {
        query = query.eq("vendedor_id", options.vendedorId);
      }
      if (options?.limit) {
        query = query.limit(options.limit);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as AlertaAuditoria[];
    },
  });
}

// Hook para ranking de vendedores por score de risco
export function useVendedoresRisco() {
  return useQuery({
    queryKey: ["vendedores-risco"],
    queryFn: async (): Promise<VendedorMonitoramento[]> => {
      const { data, error } = await supabase
        .from("vendedores_monitoramento")
        .select(`
          *,
          vendedor:profiles!vendedores_monitoramento_vendedor_id_fkey(id, nome, avatar_url)
        `)
        .order("score_risco_acumulado", { ascending: false });

      if (error) throw error;
      return data as VendedorMonitoramento[];
    },
  });
}

// Hook para métricas de vendedores
export function useMetricasVendedores() {
  return useQuery({
    queryKey: ["metricas-vendedores"],
    queryFn: async (): Promise<MetricasVendedor[]> => {
      const { data, error } = await supabase
        .from("vw_metricas_vendedores")
        .select("*")
        .order("total_leads", { ascending: false });

      if (error) throw error;
      return data as MetricasVendedor[];
    },
  });
}

// Hook para CPFs duplicados
export function useCPFsDuplicados() {
  return useQuery({
    queryKey: ["cpfs-duplicados"],
    queryFn: async (): Promise<CPFDuplicado[]> => {
      const { data, error } = await supabase
        .from("vw_cpfs_duplicados")
        .select("*")
        .order("qtd_vendedores", { ascending: false });

      if (error) throw error;
      return data as CPFDuplicado[];
    },
  });
}

// Hook para buscar monitoramento de um vendedor específico
export function useVendedorMonitoramento(vendedorId: string | undefined) {
  return useQuery({
    queryKey: ["vendedor-monitoramento", vendedorId],
    queryFn: async (): Promise<VendedorMonitoramento | null> => {
      if (!vendedorId) return null;

      const { data, error } = await supabase
        .from("vendedores_monitoramento")
        .select("*")
        .eq("vendedor_id", vendedorId)
        .maybeSingle();

      if (error) throw error;
      return data as VendedorMonitoramento | null;
    },
    enabled: !!vendedorId,
  });
}

// Hook para histórico de alertas de um vendedor
export function useVendedorHistoricoAuditoria(vendedorId: string | undefined) {
  return useQuery({
    queryKey: ["vendedor-historico-auditoria", vendedorId],
    queryFn: async (): Promise<AlertaAuditoria[]> => {
      if (!vendedorId) return [];

      const { data, error } = await supabase
        .from("auditoria_vendedores")
        .select("*")
        .eq("vendedor_id", vendedorId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as AlertaAuditoria[];
    },
    enabled: !!vendedorId,
  });
}

// Mutation para analisar alerta
export function useAnalisarAlerta() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      alertaId,
      status,
      observacoes,
    }: {
      alertaId: string;
      status: "analisado" | "ignorado" | "confirmado";
      observacoes?: string;
    }) => {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error("Usuário não autenticado");

      const { data: profile } = await supabase
        .from("profiles")
        .select("id")
        .eq("user_id", userData.user.id)
        .single();

      if (!profile) throw new Error("Perfil não encontrado");

      const { error } = await supabase
        .from("auditoria_vendedores")
        .update({
          status,
          analisado_por: profile.id,
          analisado_em: new Date().toISOString(),
          observacoes_analise: observacoes,
        })
        .eq("id", alertaId);

      if (error) throw error;

      // Se confirmado, incrementar alertas confirmados no monitoramento
      if (status === "confirmado") {
        const { data: alerta } = await supabase
          .from("auditoria_vendedores")
          .select("vendedor_id")
          .eq("id", alertaId)
          .single();

        if (alerta) {
          // Atualizar diretamente
          const { data: mon } = await supabase
            .from("vendedores_monitoramento")
            .select("id, alertas_confirmados")
            .eq("vendedor_id", alerta.vendedor_id)
            .single();

          if (mon) {
            await supabase
              .from("vendedores_monitoramento")
              .update({ alertas_confirmados: (mon.alertas_confirmados || 0) + 1 })
              .eq("id", mon.id);
          }
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["auditoria-alertas"] });
      queryClient.invalidateQueries({ queryKey: ["auditoria-alertas-pendentes"] });
      queryClient.invalidateQueries({ queryKey: ["vendedores-risco"] });
    },
  });
}

// Mutation para atualizar status de monitoramento
export function useAtualizarMonitoramento() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      vendedorId,
      status,
      motivo,
      observacoes,
    }: {
      vendedorId: string;
      status: "normal" | "sob_observacao" | "suspenso";
      motivo?: string;
      observacoes?: string;
    }) => {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error("Usuário não autenticado");

      const { data: profile } = await supabase
        .from("profiles")
        .select("id")
        .eq("user_id", userData.user.id)
        .single();

      if (!profile) throw new Error("Perfil não encontrado");

      // Verificar se já existe registro
      const { data: existente } = await supabase
        .from("vendedores_monitoramento")
        .select("id")
        .eq("vendedor_id", vendedorId)
        .maybeSingle();

      if (existente) {
        const { error } = await supabase
          .from("vendedores_monitoramento")
          .update({
            status_monitoramento: status,
            motivo,
            observacoes,
            analisado_por: profile.id,
            ultima_analise: new Date().toISOString(),
          })
          .eq("id", existente.id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("vendedores_monitoramento")
          .insert({
            vendedor_id: vendedorId,
            status_monitoramento: status,
            motivo,
            observacoes,
            analisado_por: profile.id,
            ultima_analise: new Date().toISOString(),
          });

        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vendedores-risco"] });
      queryClient.invalidateQueries({ queryKey: ["vendedor-monitoramento"] });
    },
  });
}

// Mutation para executar análise manual
export function useExecutarAnalise() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (vendedorId?: string) => {
      const { data, error } = await supabase.functions.invoke("analisar-exclusividade", {
        body: { vendedorId },
      });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["auditoria-alertas"] });
      queryClient.invalidateQueries({ queryKey: ["auditoria-alertas-pendentes"] });
      queryClient.invalidateQueries({ queryKey: ["vendedores-risco"] });
      queryClient.invalidateQueries({ queryKey: ["cpfs-duplicados"] });
    },
  });
}

// Estatísticas gerais de auditoria
export function useAuditoriaStats() {
  return useQuery({
    queryKey: ["auditoria-stats"],
    queryFn: async () => {
      const [
        { count: totalAlertas },
        { count: alertasPendentes },
        { count: vendedoresSobObservacao },
        { count: vendedoresSuspensos },
      ] = await Promise.all([
        supabase.from("auditoria_vendedores").select("*", { count: "exact", head: true }),
        supabase
          .from("auditoria_vendedores")
          .select("*", { count: "exact", head: true })
          .eq("status", "pendente"),
        supabase
          .from("vendedores_monitoramento")
          .select("*", { count: "exact", head: true })
          .eq("status_monitoramento", "sob_observacao"),
        supabase
          .from("vendedores_monitoramento")
          .select("*", { count: "exact", head: true })
          .eq("status_monitoramento", "suspenso"),
      ]);

      return {
        totalAlertas: totalAlertas || 0,
        alertasPendentes: alertasPendentes || 0,
        vendedoresSobObservacao: vendedoresSobObservacao || 0,
        vendedoresSuspensos: vendedoresSuspensos || 0,
      };
    },
  });
}
