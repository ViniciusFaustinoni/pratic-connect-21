import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface AssociacaoConcorrente {
  id: string;
  nome: string;
  cnpj: string | null;
  palavras_chave: string[] | null;
  dominios_email: string[] | null;
  ativo: boolean;
  created_at: string;
  updated_at: string;
}

export interface IndiciosConcorrencia {
  id: string;
  vendedor_id: string;
  tipo_indicio: string;
  descricao: string | null;
  associacao_concorrente_id: string | null;
  dados_evidencia: Record<string, any> | null;
  score_risco: number;
  status: "pendente" | "analisado" | "confirmado" | "ignorado";
  analisado_por: string | null;
  analisado_em: string | null;
  observacoes: string | null;
  created_at: string;
  vendedor?: {
    id: string;
    nome: string;
    avatar_url: string | null;
  };
  associacao_concorrente?: {
    id: string;
    nome: string;
  };
}

export interface VendedorConflito {
  vendedor_id: string;
  nome: string;
  email: string;
  total_indicios: number;
  indicios_confirmados: number;
  indicios_pendentes: number;
  ultimo_indicio: string | null;
  score_total: number;
  associacoes_envolvidas: string[] | null;
}

// Hook para buscar associações concorrentes cadastradas
export function useAssociacoesConcorrentes(apenasAtivas = true) {
  return useQuery({
    queryKey: ["associacoes-concorrentes", apenasAtivas],
    queryFn: async (): Promise<AssociacaoConcorrente[]> => {
      let query = supabase
        .from("associacoes_concorrentes")
        .select("*")
        .order("nome", { ascending: true });

      if (apenasAtivas) {
        query = query.eq("ativo", true);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as AssociacaoConcorrente[];
    },
  });
}

// Hook para buscar indícios de concorrência
export function useIndiciosConcorrencia(options?: {
  status?: string;
  vendedorId?: string;
  limit?: number;
}) {
  return useQuery({
    queryKey: ["indicios-concorrencia", options],
    queryFn: async (): Promise<IndiciosConcorrencia[]> => {
      let query = supabase
        .from("auditoria_indicios_concorrencia")
        .select(`
          *,
          vendedor:profiles!auditoria_indicios_concorrencia_vendedor_id_fkey(id, nome, avatar_url),
          associacao_concorrente:associacoes_concorrentes(id, nome)
        `)
        .order("created_at", { ascending: false });

      if (options?.status) {
        query = query.eq("status", options.status);
      }
      if (options?.vendedorId) {
        query = query.eq("vendedor_id", options.vendedorId);
      }
      if (options?.limit) {
        query = query.limit(options.limit);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as IndiciosConcorrencia[];
    },
  });
}

// Hook para buscar vendedores com conflitos (view)
export function useVendedoresConflito() {
  return useQuery({
    queryKey: ["vendedores-conflito"],
    queryFn: async (): Promise<VendedorConflito[]> => {
      const { data, error } = await supabase
        .from("vw_vendedores_conflito")
        .select("*")
        .order("score_total", { ascending: false });

      if (error) throw error;
      return data as VendedorConflito[];
    },
  });
}

// Hook para estatísticas de concorrência
export function useConcorrenciaStats() {
  return useQuery({
    queryKey: ["concorrencia-stats"],
    queryFn: async () => {
      const [
        { count: totalIndicios },
        { count: indiciosPendentes },
        { count: indiciosConfirmados },
        { count: vendedoresComConflito },
      ] = await Promise.all([
        supabase.from("auditoria_indicios_concorrencia").select("*", { count: "exact", head: true }),
        supabase
          .from("auditoria_indicios_concorrencia")
          .select("*", { count: "exact", head: true })
          .eq("status", "pendente"),
        supabase
          .from("auditoria_indicios_concorrencia")
          .select("*", { count: "exact", head: true })
          .eq("status", "confirmado"),
        supabase
          .from("vw_vendedores_conflito")
          .select("*", { count: "exact", head: true }),
      ]);

      return {
        totalIndicios: totalIndicios || 0,
        indiciosPendentes: indiciosPendentes || 0,
        indiciosConfirmados: indiciosConfirmados || 0,
        vendedoresComConflito: vendedoresComConflito || 0,
      };
    },
  });
}

// Mutation para criar associação concorrente
export function useCriarAssociacaoConcorrente() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: Omit<AssociacaoConcorrente, "id" | "created_at" | "updated_at">) => {
      const { data: result, error } = await supabase
        .from("associacoes_concorrentes")
        .insert(data)
        .select()
        .single();

      if (error) throw error;
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["associacoes-concorrentes"] });
    },
  });
}

// Mutation para atualizar associação concorrente
export function useAtualizarAssociacaoConcorrente() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      data,
    }: {
      id: string;
      data: Partial<Omit<AssociacaoConcorrente, "id" | "created_at" | "updated_at">>;
    }) => {
      const { error } = await supabase
        .from("associacoes_concorrentes")
        .update(data)
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["associacoes-concorrentes"] });
    },
  });
}

// Mutation para deletar associação concorrente
export function useDeletarAssociacaoConcorrente() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("associacoes_concorrentes")
        .delete()
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["associacoes-concorrentes"] });
    },
  });
}

// Mutation para analisar indício
export function useAnalisarIndicio() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      indicioId,
      status,
      observacoes,
    }: {
      indicioId: string;
      status: "analisado" | "confirmado" | "ignorado";
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
        .from("auditoria_indicios_concorrencia")
        .update({
          status,
          analisado_por: profile.id,
          analisado_em: new Date().toISOString(),
          observacoes,
        })
        .eq("id", indicioId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["indicios-concorrencia"] });
      queryClient.invalidateQueries({ queryKey: ["vendedores-conflito"] });
      queryClient.invalidateQueries({ queryKey: ["concorrencia-stats"] });
    },
  });
}
