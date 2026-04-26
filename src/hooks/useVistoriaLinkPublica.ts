import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { publicSupabase } from '@/integrations/supabase/publicClient';
import { toast } from 'sonner';

export type VistoriaLinkStatus =
  | 'pendente'
  | 'fotos_concluidas'
  | 'instalacao_concluida'
  | 'concluido'
  | 'cancelado';

export type EtapaStatus = 'pendente' | 'em_andamento' | 'concluida';

export interface VistoriaLink {
  id: string;
  instalacao_id: string;
  vistoria_id: string | null;
  token: string;
  status: VistoriaLinkStatus;
  fotos_etapa_status: EtapaStatus;
  instalacao_etapa_status: EtapaStatus;
  fotos_concluida_em: string | null;
  instalacao_concluida_em: string | null;
  fotos_executor_nome: string | null;
  instalacao_executor_nome: string | null;
  instalacao_executor_tipo: 'interno' | 'prestador' | 'publico' | null;
  tecnico_atribuido_id: string | null;
  prestador_atribuido_id: string | null;
  iniciada_em: string | null;
  fotos_aprovadas_em: string | null;
  fotos_aprovadas_por: string | null;
  fotos_reprovadas_em: string | null;
  fotos_reprovadas_por: string | null;
  fotos_reprovacao_motivo: string | null;
  // Rascunho da etapa pública de fotos
  fotos_rascunho_executor_nome: string | null;
  fotos_rascunho_conferencia: { placa?: boolean; chassi?: boolean; modelo?: boolean; cor?: boolean } | null;
  fotos_rascunho_hodometro: string | null;
  fotos_rascunho_observacoes: string | null;
  fotos_rascunho_atualizado_em: string | null;
  created_at: string;
  updated_at: string;
}

const BASE_URL = 'https://app.praticcar.org';

export const buildVistoriaLinkUrl = (token: string) => `${BASE_URL}/vistoria/${token}`;

/**
 * Busca o link público unificado de vistoria associado a uma cotação ou instalação.
 */
export function useVistoriaLink(params: { cotacaoId?: string | null; instalacaoId?: string | null }) {
  const { cotacaoId = null, instalacaoId = null } = params;

  return useQuery({
    queryKey: ['vistoria-link', cotacaoId, instalacaoId],
    enabled: !!cotacaoId || !!instalacaoId,
    queryFn: async (): Promise<VistoriaLink | null> => {
      let instId: string | null = instalacaoId;
      if (!instId && cotacaoId) {
        const { data: inst } = await supabase
          .from('instalacoes')
          .select('id')
          .eq('cotacao_id', cotacaoId)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        instId = inst?.id ?? null;
      }
      if (!instId) return null;

      const { data, error } = await supabase
        .from('vistoria_links' as any)
        .select('*')
        .eq('instalacao_id', instId)
        .maybeSingle();

      if (error) throw error;
      return (data as any) || null;
    },
    refetchInterval: 30_000,
  });
}

/**
 * Versão pública (anon) — usada na página /vistoria/:token.
 */
export function useVistoriaLinkPorToken(token: string | undefined | null) {
  return useQuery({
    queryKey: ['vistoria-link-token', token],
    enabled: !!token,
    queryFn: async (): Promise<VistoriaLink | null> => {
      const { data, error } = await publicSupabase
        .from('vistoria_links' as any)
        .select('*')
        .eq('token', token!)
        .maybeSingle();
      if (error) throw error;
      return (data as any) || null;
    },
    refetchInterval: 20_000,
    refetchOnWindowFocus: true,
  });
}

/**
 * Gera (ou reutiliza) o link público de vistoria para uma instalação/cotação.
 * Idempotente: pode ser chamado múltiplas vezes sem efeito colateral.
 */
export function useGerarVistoriaLink() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (params: {
      instalacaoId?: string;
      cotacaoId?: string;
      vistoriaId?: string;
      tecnicoAtribuidoId?: string | null;
      prestadorAtribuidoId?: string | null;
      criadoPor?: string | null;
    }) => {
      const { data, error } = await supabase.functions.invoke('gerar-link-vistoria-publica', {
        body: {
          instalacao_id: params.instalacaoId,
          cotacao_id: params.cotacaoId,
          vistoria_id: params.vistoriaId,
          tecnico_atribuido_id: params.tecnicoAtribuidoId ?? null,
          prestador_atribuido_id: params.prestadorAtribuidoId ?? null,
          criado_por: params.criadoPor ?? null,
        },
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || 'Erro ao gerar link');
      return data as { token: string; url: string; reused: boolean };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vistoria-link'] });
    },
  });
}

/**
 * Marca a etapa como em andamento (chamada ao tocar no botão da home pública).
 * Reflete o "em andamento" no monitoramento sem esperar a conclusão.
 * Idempotente — chamadas repetidas não regridem status.
 */
export function useIniciarEtapaPublica() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (params: {
      token: string;
      etapa: 'fotos' | 'instalacao';
      executorNome?: string | null;
      executorTelefone?: string | null;
      executorUserId?: string | null;
    }) => {
      const { data, error } = await publicSupabase.functions.invoke('iniciar-etapa-vistoria-publica', {
        body: {
          token: params.token,
          etapa: params.etapa,
          executor_nome: params.executorNome ?? null,
          executor_telefone: params.executorTelefone ?? null,
          executor_user_id: params.executorUserId ?? null,
        },
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || 'Erro ao iniciar etapa');
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['vistoria-link-token', variables.token] });
    },
  });
}

/**
 * Conclui a etapa de Fotos & Vídeo (chamada do link público).
 */
export function useConcluirEtapaFotosPublica() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (params: {
      token: string;
      executorNome?: string | null;
      checklistData?: any;
      fotos?: Record<string, string>;
      video360Url?: string | null;
      hodometro?: number | null;
      observacoes?: string | null;
    }) => {
      const { data, error } = await publicSupabase.functions.invoke('concluir-etapa-fotos-publica', {
        body: {
          token: params.token,
          executor_nome: params.executorNome ?? null,
          checklist_data: params.checklistData ?? null,
          fotos: params.fotos ?? null,
          video_360_url: params.video360Url ?? null,
          hodometro: params.hodometro ?? null,
          observacoes: params.observacoes ?? null,
        },
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || 'Erro ao concluir etapa');
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['vistoria-link-token', variables.token] });
      toast.success('Etapa de fotos concluída!');
    },
    onError: (err: any) => {
      toast.error(err?.message || 'Erro ao concluir etapa de fotos');
    },
  });
}

/**
 * Conclui a etapa de Instalação do Rastreador (chamada do link público).
 */
export function useConcluirEtapaInstalacaoPublica() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (params: {
      token: string;
      executorNome: string;
      checklistData?: any;
      fotos?: Record<string, string>;
    }) => {
      const { data, error } = await publicSupabase.functions.invoke('concluir-etapa-instalacao-publica', {
        body: {
          token: params.token,
          executor_nome: params.executorNome,
          checklist_data: params.checklistData ?? null,
          fotos: params.fotos ?? null,
        },
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || 'Erro ao concluir etapa');
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['vistoria-link-token', variables.token] });
      toast.success('Instalação registrada com sucesso!');
    },
    onError: (err: any) => {
      toast.error(err?.message || 'Erro ao concluir etapa de instalação');
    },
  });
}

/**
 * Aprovação das fotos pelo monitoramento — libera a etapa de instalação no link público.
 */
export function useAprovarFotosVistoria() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (params: { vistoriaLinkId: string }) => {
      const { data, error } = await supabase.functions.invoke('aprovar-fotos-vistoria-link', {
        body: { vistoria_link_id: params.vistoriaLinkId },
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || 'Erro ao aprovar fotos');
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vistoria-link'] });
      queryClient.invalidateQueries({ queryKey: ['vistoria-links-aprovacao'] });
      toast.success('Fotos aprovadas — etapa de instalação liberada.');
    },
    onError: (err: any) => {
      toast.error(err?.message || 'Erro ao aprovar fotos');
    },
  });
}

/**
 * Reprovação das fotos pelo monitoramento — reabre a etapa de fotos com motivo.
 */
export function useReprovarFotosVistoria() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (params: { vistoriaLinkId: string; motivo: string }) => {
      const { data, error } = await supabase.functions.invoke('reprovar-fotos-vistoria-link', {
        body: { vistoria_link_id: params.vistoriaLinkId, motivo: params.motivo },
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || 'Erro ao reprovar fotos');
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vistoria-link'] });
      queryClient.invalidateQueries({ queryKey: ['vistoria-links-aprovacao'] });
      toast.success('Fotos reprovadas — link reaberto para novo envio.');
    },
    onError: (err: any) => {
      toast.error(err?.message || 'Erro ao reprovar fotos');
    },
  });
}

/**
 * Técnico logado assume a instalação vinculada ao link público.
 * Atribuição atômica + validação de fotos aprovadas.
 */
export function useAssumirInstalacaoVistoria() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (params: { token: string }) => {
      const { data, error } = await supabase.functions.invoke('assumir-instalacao-vistoria-link', {
        body: { token: params.token },
      });
      if (error) {
        // Erro com payload (ex.: 409 alreadyAssigned) — repassar mensagem
        const ctx = (error as any)?.context;
        if (ctx?.body) {
          try {
            const parsed = typeof ctx.body === 'string' ? JSON.parse(ctx.body) : ctx.body;
            const e: any = new Error(parsed?.error || 'Erro ao assumir instalação');
            e.alreadyAssigned = !!parsed?.alreadyAssigned;
            e.tecnico_nome = parsed?.tecnico_nome || null;
            throw e;
          } catch {
            /* ignora parse */
          }
        }
        throw error;
      }
      if (!data?.success) {
        const e: any = new Error(data?.error || 'Erro ao assumir instalação');
        e.alreadyAssigned = !!data?.alreadyAssigned;
        e.tecnico_nome = data?.tecnico_nome || null;
        throw e;
      }
      return data as { success: true; instalacao_id: string | null; redirect_to: string | null };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vistoria-link'] });
      queryClient.invalidateQueries({ queryKey: ['vistoria-link-token'] });
    },
  });
}

/**
 * Lista de links de vistoria com fotos aguardando aprovação no monitoramento.
 */
export function useVistoriaLinksAguardandoAprovacao() {
  return useQuery({
    queryKey: ['vistoria-links-aprovacao'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('vistoria_links' as any)
        .select(`
          id, token, instalacao_id, fotos_concluida_em, fotos_executor_nome,
          instalacoes:instalacao_id(
            id, data_agendada, periodo, cidade, uf,
            associados:associado_id(nome, telefone),
            veiculos:veiculo_id(marca, modelo, placa)
          )
        `)
        .eq('fotos_etapa_status', 'concluida')
        .is('fotos_aprovadas_em', null)
        .is('fotos_reprovadas_em', null)
        .order('fotos_concluida_em', { ascending: true });
      if (error) throw error;
      return (data as any[]) || [];
    },
    refetchInterval: 30_000,
  });
}
