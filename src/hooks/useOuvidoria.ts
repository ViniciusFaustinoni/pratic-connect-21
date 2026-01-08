import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type {
  Manifestacao,
  ManifestacaoWithRelations,
  ManifestacaoFilters,
  TipoManifestacao,
  StatusManifestacao,
  PrioridadeManifestacao,
  CategoriaManifestacao,
  CanalManifestacao,
} from "@/types/ouvidoria";

// Hook para listar manifestações com filtros
export function useManifestacoes(filters?: ManifestacaoFilters) {
  return useQuery({
    queryKey: ["ouvidoria", "manifestacoes", filters],
    queryFn: async () => {
      let query = supabase
        .from("ouvidoria_manifestacoes")
        .select(`
          *,
          associado:associados(id, nome, telefone, email, cpf),
          responsavel:profiles!ouvidoria_manifestacoes_responsavel_id_fkey(id, nome, email)
        `)
        .order("created_at", { ascending: false });

      if (filters?.tipo) {
        query = query.eq("tipo", filters.tipo);
      }
      if (filters?.status) {
        query = query.eq("status", filters.status);
      }
      if (filters?.prioridade) {
        query = query.eq("prioridade", filters.prioridade);
      }
      if (filters?.responsavel_id) {
        query = query.eq("responsavel_id", filters.responsavel_id);
      }
      if (filters?.categoria) {
        query = query.eq("categoria", filters.categoria);
      }
      if (filters?.data_inicio) {
        query = query.gte("created_at", filters.data_inicio);
      }
      if (filters?.data_fim) {
        query = query.lte("created_at", filters.data_fim);
      }
      if (filters?.search) {
        query = query.or(
          `protocolo.ilike.%${filters.search}%,assunto.ilike.%${filters.search}%`
        );
      }

      const { data, error } = await query;

      if (error) throw error;
      return data as ManifestacaoWithRelations[];
    },
  });
}

// Hook para buscar uma manifestação por ID
export function useManifestacao(id: string | undefined) {
  return useQuery({
    queryKey: ["ouvidoria", "manifestacao", id],
    queryFn: async () => {
      if (!id) return null;

      const { data, error } = await supabase
        .from("ouvidoria_manifestacoes")
        .select(`
          *,
          associado:associados(id, nome, telefone, email, cpf),
          responsavel:profiles!ouvidoria_manifestacoes_responsavel_id_fkey(id, nome, email)
        `)
        .eq("id", id)
        .single();

      if (error) throw error;
      return data as ManifestacaoWithRelations;
    },
    enabled: !!id,
  });
}

// Hook para estatísticas do dashboard
export function useEstatisticasOuvidoria() {
  return useQuery({
    queryKey: ["ouvidoria", "estatisticas"],
    queryFn: async () => {
      const { data: manifestacoes, error } = await supabase
        .from("ouvidoria_manifestacoes")
        .select("id, tipo, status, prioridade, created_at, data_primeira_resposta, avaliacao_nota");

      if (error) throw error;

      const total = manifestacoes.length;
      const abertas = manifestacoes.filter((m) => m.status === "aberto").length;
      const em_analise = manifestacoes.filter((m) => m.status === "em_analise").length;
      const respondidas = manifestacoes.filter((m) => m.status === "respondido").length;
      const encerradas = manifestacoes.filter((m) => m.status === "encerrado").length;

      // SLA em risco: abertas há mais de 20h (próximas 4h para estourar 24h)
      const agora = new Date();
      const sla_em_risco = manifestacoes.filter((m) => {
        if (m.status === "encerrado") return false;
        const criado = new Date(m.created_at);
        const horasDesdeAbertura = (agora.getTime() - criado.getTime()) / (1000 * 60 * 60);
        return horasDesdeAbertura >= 20 && !m.data_primeira_resposta;
      }).length;

      // Tempo médio de resposta
      const comResposta = manifestacoes.filter((m) => m.data_primeira_resposta);
      let tempo_medio_resposta_horas = 0;
      if (comResposta.length > 0) {
        const somaHoras = comResposta.reduce((acc, m) => {
          const criado = new Date(m.created_at);
          const respondido = new Date(m.data_primeira_resposta!);
          return acc + (respondido.getTime() - criado.getTime()) / (1000 * 60 * 60);
        }, 0);
        tempo_medio_resposta_horas = somaHoras / comResposta.length;
      }

      // NPS (notas de avaliação)
      const comNota = manifestacoes.filter((m) => m.avaliacao_nota !== null);
      let nps = 0;
      if (comNota.length > 0) {
        const promotores = comNota.filter((m) => m.avaliacao_nota! >= 4).length;
        const detratores = comNota.filter((m) => m.avaliacao_nota! <= 2).length;
        nps = Math.round(((promotores - detratores) / comNota.length) * 100);
      }

      // Por tipo
      const por_tipo = {
        reclamacao: manifestacoes.filter((m) => m.tipo === "reclamacao").length,
        sugestao: manifestacoes.filter((m) => m.tipo === "sugestao").length,
        elogio: manifestacoes.filter((m) => m.tipo === "elogio").length,
        denuncia: manifestacoes.filter((m) => m.tipo === "denuncia").length,
        duvida: manifestacoes.filter((m) => m.tipo === "duvida").length,
      };

      // Por prioridade
      const por_prioridade = {
        baixa: manifestacoes.filter((m) => m.prioridade === "baixa").length,
        normal: manifestacoes.filter((m) => m.prioridade === "normal").length,
        alta: manifestacoes.filter((m) => m.prioridade === "alta").length,
        urgente: manifestacoes.filter((m) => m.prioridade === "urgente").length,
      };

      return {
        total,
        abertas,
        em_analise,
        respondidas,
        encerradas,
        sla_em_risco,
        tempo_medio_resposta_horas,
        nps,
        por_tipo,
        por_prioridade,
      };
    },
  });
}

// Hook para criar manifestação
export function useCreateManifestacao() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      associado_id?: string;
      tipo: TipoManifestacao;
      categoria?: CategoriaManifestacao;
      assunto: string;
      descricao: string;
      anonimo?: boolean;
      canal: CanalManifestacao;
      prioridade?: PrioridadeManifestacao;
    }) => {
      // Inserir sem protocolo - o trigger gera automaticamente
      const { data: manifestacao, error } = await supabase
        .from("ouvidoria_manifestacoes")
        .insert({
          ...data,
          protocolo: '', // Será substituído pelo trigger
        })
        .select()
        .single();

      if (error) throw error;
      return manifestacao;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ouvidoria"] });
      toast.success("Manifestação criada com sucesso!");
    },
    onError: (error) => {
      console.error("Erro ao criar manifestação:", error);
      toast.error("Erro ao criar manifestação");
    },
  });
}

// Hook para atualizar status
export function useUpdateStatusManifestacao() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      status,
      observacao,
    }: {
      id: string;
      status: StatusManifestacao;
      observacao?: string;
    }) => {
      const updates: Record<string, unknown> = { status };

      if (status === "encerrado") {
        updates.data_encerramento = new Date().toISOString();
      }

      const { error: updateError } = await supabase
        .from("ouvidoria_manifestacoes")
        .update(updates)
        .eq("id", id);

      if (updateError) throw updateError;

      // Registrar interação de mudança de status
      if (observacao) {
        const { error: interacaoError } = await supabase
          .from("ouvidoria_interacoes")
          .insert({
            manifestacao_id: id,
            tipo: "status_change",
            mensagem: `Status alterado para ${status}. ${observacao}`,
            visivel_associado: true,
          });

        if (interacaoError) throw interacaoError;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ouvidoria"] });
      toast.success("Status atualizado!");
    },
    onError: (error) => {
      console.error("Erro ao atualizar status:", error);
      toast.error("Erro ao atualizar status");
    },
  });
}

// Hook para assumir manifestação
export function useAssumirManifestacao() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) throw new Error("Usuário não autenticado");

      const { error } = await supabase
        .from("ouvidoria_manifestacoes")
        .update({
          responsavel_id: user.id,
          status: "em_analise",
        })
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ouvidoria"] });
      toast.success("Manifestação assumida!");
    },
    onError: (error) => {
      console.error("Erro ao assumir manifestação:", error);
      toast.error("Erro ao assumir manifestação");
    },
  });
}

// Hook para responder manifestação
export function useResponderManifestacao() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      mensagem,
      visivel_associado = true,
      tipo = "resposta_interna",
    }: {
      id: string;
      mensagem: string;
      visivel_associado?: boolean;
      tipo?: "resposta_interna" | "nota_interna";
    }) => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      // Inserir interação
      const { error: interacaoError } = await supabase
        .from("ouvidoria_interacoes")
        .insert({
          manifestacao_id: id,
          usuario_id: user?.id,
          tipo,
          mensagem,
          visivel_associado,
        });

      if (interacaoError) throw interacaoError;

      // Buscar manifestação para verificar se é primeira resposta
      const { data: manifestacao } = await supabase
        .from("ouvidoria_manifestacoes")
        .select("data_primeira_resposta")
        .eq("id", id)
        .single();

      // Atualizar manifestação
      const updates: Record<string, unknown> = {
        status: "respondido",
      };

      if (!manifestacao?.data_primeira_resposta && visivel_associado) {
        updates.data_primeira_resposta = new Date().toISOString();
      }

      const { error: updateError } = await supabase
        .from("ouvidoria_manifestacoes")
        .update(updates)
        .eq("id", id);

      if (updateError) throw updateError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ouvidoria"] });
      toast.success("Resposta enviada!");
    },
    onError: (error) => {
      console.error("Erro ao responder:", error);
      toast.error("Erro ao enviar resposta");
    },
  });
}

// Hook para encaminhar ao jurídico
export function useEncaminharJuridico() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      manifestacao_id,
      observacao,
    }: {
      manifestacao_id: string;
      observacao?: string;
    }) => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      // Buscar manifestação
      const { data: manifestacao } = await supabase
        .from("ouvidoria_manifestacoes")
        .select("*, associado:associados(nome)")
        .eq("id", manifestacao_id)
        .single();

      if (!manifestacao) throw new Error("Manifestação não encontrada");

      // Criar processo jurídico
      const { data: processo, error: processoError } = await supabase
        .from("processos")
        .insert({
          associado_id: manifestacao.associado_id,
          tipo: "administrativo",
          natureza: "Administrativo",
          status: "em_andamento",
          parte_contraria_nome: "N/A - Ouvidoria Interna",
          objeto: `Encaminhamento da Ouvidoria - Protocolo ${manifestacao.protocolo}\n\n${manifestacao.descricao}`,
          observacoes: observacao || null,
          criado_por: user?.id,
        })
        .select()
        .single();

      if (processoError) throw processoError;

      // Vincular processo à manifestação
      const { error: vinculoError } = await supabase
        .from("ouvidoria_manifestacoes")
        .update({ vinculo_juridico_id: processo.id })
        .eq("id", manifestacao_id);

      if (vinculoError) throw vinculoError;

      // Registrar interação
      const { error: interacaoError } = await supabase
        .from("ouvidoria_interacoes")
        .insert({
          manifestacao_id,
          usuario_id: user?.id,
          tipo: "encaminhamento",
          mensagem: `Encaminhado para o Jurídico. ${observacao || ""}`,
          visivel_associado: false,
        });

      if (interacaoError) throw interacaoError;

      return processo;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ouvidoria"] });
      queryClient.invalidateQueries({ queryKey: ["processos"] });
      toast.success("Encaminhado para o Jurídico!");
    },
    onError: (error) => {
      console.error("Erro ao encaminhar:", error);
      toast.error("Erro ao encaminhar para o Jurídico");
    },
  });
}
