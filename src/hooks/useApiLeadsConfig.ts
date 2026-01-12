import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { Json } from '@/integrations/supabase/types';

export interface ApiLeadsConfig {
  id: string;
  nome: string;
  slug: string;
  tipo: string;
  icone: string;
  cor: string;
  ativo: boolean;
  api_key_id: string | null;
  webhook_url: string | null;
  configuracoes: Json;
  leads_recebidos: number;
  ultimo_lead_em: string | null;
  created_at: string;
  updated_at: string;
}

export function useApiLeadsConfig() {
  return useQuery({
    queryKey: ['api-leads-config'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('api_leads_config')
        .select('*')
        .order('nome', { ascending: true });

      if (error) throw error;
      return data as ApiLeadsConfig[];
    },
  });
}

export function useUpdateApiLeadsConfig() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<Omit<ApiLeadsConfig, 'configuracoes'>> & { configuracoes?: Json } }) => {
      const { data, error } = await supabase
        .from('api_leads_config')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['api-leads-config'] });
    },
    onError: (error) => {
      toast.error('Erro ao atualizar configuração: ' + error.message);
    },
  });
}

export function useToggleApiIntegration() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ativo }: { id: string; ativo: boolean }) => {
      const { error } = await supabase
        .from('api_leads_config')
        .update({ ativo })
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['api-leads-config'] });
      toast.success(variables.ativo ? 'Integração ativada!' : 'Integração desativada!');
    },
    onError: (error) => {
      toast.error('Erro ao alterar status: ' + error.message);
    },
  });
}

export function useCreateApiLeadsConfig() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (config: { nome: string; slug: string; tipo: string; icone?: string; cor?: string }) => {
      const { data, error } = await supabase
        .from('api_leads_config')
        .insert(config)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['api-leads-config'] });
      toast.success('Integração criada com sucesso!');
    },
    onError: (error) => {
      toast.error('Erro ao criar integração: ' + error.message);
    },
  });
}
