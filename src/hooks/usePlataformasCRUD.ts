import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface PlataformaOption {
  codigo: string;
  nome: string;
  icone?: string | null;
}

export interface PlataformaCompleta {
  id: string;
  plataforma: string;
  nome_exibicao: string;
  descricao?: string | null;
  icone?: string | null;
  ordem?: number | null;
  api_url_sandbox?: string | null;
  api_url_producao?: string | null;
  auth_type?: string | null;
  suporta_posicao_tempo_real?: boolean | null;
  suporta_historico_trajeto?: boolean | null;
  suporta_acionamento_roubo?: boolean | null;
  suporta_bloqueio?: boolean | null;
  suporta_webhooks?: boolean | null;
  suporta_redefinir_senha?: boolean | null;
  ativa?: boolean | null;
  ambiente_atual?: string | null;
  config?: Record<string, unknown> | null;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface PlataformaFormData {
  plataforma: string;
  nome_exibicao: string;
  descricao?: string;
  icone?: string;
  ordem?: number;
  api_url_sandbox?: string;
  api_url_producao?: string;
  auth_type?: string;
  suporta_posicao_tempo_real?: boolean;
  suporta_historico_trajeto?: boolean;
  suporta_acionamento_roubo?: boolean;
  suporta_bloqueio?: boolean;
  suporta_webhooks?: boolean;
  ativa?: boolean;
  ambiente_atual?: string;
}

// Hook para buscar opções de plataformas (para selects)
export function usePlataformasOptions() {
  return useQuery({
    queryKey: ['plataformas-options'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('rastreadores_config_plataformas')
        .select('plataforma, nome_exibicao, icone')
        .eq('ativa', true)
        .order('ordem', { ascending: true })
        .order('nome_exibicao', { ascending: true });

      if (error) throw error;

      return (data || []).map(p => ({
        codigo: p.plataforma,
        nome: p.nome_exibicao,
        icone: p.icone,
      })) as PlataformaOption[];
    },
  });
}

// Hook para buscar labels de plataformas (mapa codigo -> nome)
export function usePlataformasLabels() {
  return useQuery({
    queryKey: ['plataformas-labels'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('rastreadores_config_plataformas')
        .select('plataforma, nome_exibicao')
        .order('ordem', { ascending: true });

      if (error) throw error;

      const labels: Record<string, string> = {};
      (data || []).forEach(p => {
        labels[p.plataforma] = p.nome_exibicao;
      });

      return labels;
    },
  });
}

// Hook para buscar todas as plataformas (para CRUD)
export function usePlataformasCompletas() {
  return useQuery({
    queryKey: ['plataformas-completas'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('rastreadores_config_plataformas')
        .select('*')
        .order('ordem', { ascending: true })
        .order('nome_exibicao', { ascending: true });

      if (error) throw error;
      return data as PlataformaCompleta[];
    },
  });
}

// Hook para buscar uma plataforma específica
export function usePlataforma(id: string | undefined) {
  return useQuery({
    queryKey: ['plataforma', id],
    queryFn: async () => {
      if (!id) return null;

      const { data, error } = await supabase
        .from('rastreadores_config_plataformas')
        .select('*')
        .eq('id', id)
        .maybeSingle();

      if (error) throw error;
      return data as PlataformaCompleta | null;
    },
    enabled: !!id,
  });
}

// Hook para criar nova plataforma
export function useCreatePlataforma() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: PlataformaFormData) => {
      const insertData = {
        plataforma: data.plataforma,
        nome_exibicao: data.nome_exibicao,
        descricao: data.descricao,
        icone: data.icone,
        ordem: data.ordem,
        api_url_sandbox: data.api_url_sandbox,
        api_url_producao: data.api_url_producao,
        auth_type: data.auth_type,
        suporta_posicao_tempo_real: data.suporta_posicao_tempo_real,
        suporta_historico_trajeto: data.suporta_historico_trajeto,
        suporta_acionamento_roubo: data.suporta_acionamento_roubo,
        suporta_bloqueio: data.suporta_bloqueio,
        suporta_webhooks: data.suporta_webhooks,
        ativa: data.ativa,
        ambiente_atual: data.ambiente_atual,
      };

      const { data: result, error } = await supabase
        .from('rastreadores_config_plataformas')
        .insert(insertData)
        .select()
        .single();

      if (error) throw error;
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['plataformas-options'] });
      queryClient.invalidateQueries({ queryKey: ['plataformas-labels'] });
      queryClient.invalidateQueries({ queryKey: ['plataformas-completas'] });
      queryClient.invalidateQueries({ queryKey: ['plataformas-config'] });
      toast.success('Plataforma criada com sucesso!');
    },
    onError: (error: Error) => {
      console.error('Erro ao criar plataforma:', error);
      if (error.message.includes('duplicate key')) {
        toast.error('Já existe uma plataforma com esse código');
      } else {
        toast.error('Erro ao criar plataforma: ' + error.message);
      }
    },
  });
}

// Hook para atualizar plataforma
export function useUpdatePlataforma() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...data }: PlataformaFormData & { id: string }) => {
      const { data: result, error } = await supabase
        .from('rastreadores_config_plataformas')
        .update(data)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return result;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['plataformas-options'] });
      queryClient.invalidateQueries({ queryKey: ['plataformas-labels'] });
      queryClient.invalidateQueries({ queryKey: ['plataformas-completas'] });
      queryClient.invalidateQueries({ queryKey: ['plataformas-config'] });
      queryClient.invalidateQueries({ queryKey: ['plataforma', variables.id] });
      toast.success('Plataforma atualizada com sucesso!');
    },
    onError: (error: Error) => {
      console.error('Erro ao atualizar plataforma:', error);
      toast.error('Erro ao atualizar plataforma: ' + error.message);
    },
  });
}

// Hook para excluir plataforma
export function useDeletePlataforma() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      // Primeiro verificar se há rastreadores vinculados
      const { data: plataforma, error: platError } = await supabase
        .from('rastreadores_config_plataformas')
        .select('plataforma')
        .eq('id', id)
        .single();

      if (platError) throw platError;

      const { count, error: countError } = await supabase
        .from('rastreadores')
        .select('*', { count: 'exact', head: true })
        .eq('plataforma', plataforma.plataforma);

      if (countError) throw countError;

      if (count && count > 0) {
        throw new Error(`Não é possível excluir. Existem ${count} rastreador(es) vinculado(s) a esta plataforma.`);
      }

      const { error } = await supabase
        .from('rastreadores_config_plataformas')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['plataformas-options'] });
      queryClient.invalidateQueries({ queryKey: ['plataformas-labels'] });
      queryClient.invalidateQueries({ queryKey: ['plataformas-completas'] });
      queryClient.invalidateQueries({ queryKey: ['plataformas-config'] });
      toast.success('Plataforma excluída com sucesso!');
    },
    onError: (error: Error) => {
      console.error('Erro ao excluir plataforma:', error);
      toast.error(error.message);
    },
  });
}

// Hook para contar rastreadores por plataforma
export function useRastreadoresPorPlataforma() {
  return useQuery({
    queryKey: ['rastreadores-por-plataforma'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('rastreadores')
        .select('plataforma, status');

      if (error) throw error;

      const contagem: Record<string, { total: number; ativos: number; online: number }> = {};

      (data || []).forEach(r => {
        if (!contagem[r.plataforma]) {
          contagem[r.plataforma] = { total: 0, ativos: 0, online: 0 };
        }
        contagem[r.plataforma].total++;
        if (r.status === 'instalado') {
          contagem[r.plataforma].ativos++;
        }
      });

      return contagem;
    },
  });
}
