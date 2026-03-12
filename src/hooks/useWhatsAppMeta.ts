import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

// ============ CONFIG ============

export function useMetaConfig() {
  return useQuery({
    queryKey: ['whatsapp-meta-config'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('whatsapp_meta_config')
        .select('*')
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}

export function useSalvarMetaConfig() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (values: { phone_number_id: string; waba_id: string; access_token?: string }) => {
      // Verificar se já existe
      const { data: existing } = await supabase
        .from('whatsapp_meta_config')
        .select('id')
        .limit(1)
        .maybeSingle();

      const updateData: any = {
        phone_number_id: values.phone_number_id,
        waba_id: values.waba_id,
        updated_at: new Date().toISOString(),
      };
      if (values.access_token !== undefined) {
        updateData.access_token = values.access_token;
      }

      if (existing) {
        const { error } = await supabase
          .from('whatsapp_meta_config')
          .update(updateData)
          .eq('id', existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('whatsapp_meta_config')
          .insert(updateData);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['whatsapp-meta-config'] });
      toast.success('Configuração da Meta salva!');
    },
    onError: (e: any) => toast.error(e.message || 'Erro ao salvar configuração'),
  });
}

export function useTestarMetaConexao() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (phone_number_id: string) => {
      const { data, error } = await supabase.functions.invoke('whatsapp-meta-test', {
        body: { phone_number_id },
      });
      if (error) throw error;
      if (!data.success) throw new Error(data.error);
      return data;
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['whatsapp-meta-config'] });
      toast.success(`Conexão OK! Número: ${data.phone_number}`);
    },
    onError: (e: any) => toast.error(e.message || 'Erro ao testar conexão'),
  });
}

export function useTrocarProvedor() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (provedor: 'evolution' | 'meta_oficial') => {
      if (provedor === 'meta_oficial') {
        // Ativar Meta, desativar Evolution
        await supabase
          .from('whatsapp_meta_config')
          .update({ ativo: true, updated_at: new Date().toISOString() })
          .neq('id', '00000000-0000-0000-0000-000000000000'); // atualiza todos
      } else {
        // Desativar Meta
        await supabase
          .from('whatsapp_meta_config')
          .update({ ativo: false, updated_at: new Date().toISOString() })
          .neq('id', '00000000-0000-0000-0000-000000000000');
      }
    },
    onSuccess: (_, provedor) => {
      qc.invalidateQueries({ queryKey: ['whatsapp-meta-config'] });
      const nome = provedor === 'meta_oficial' ? 'API Oficial da Meta' : 'Evolution API';
      toast.success(`Provedor ativo: ${nome}`);
    },
    onError: (e: any) => toast.error(e.message || 'Erro ao trocar provedor'),
  });
}

// ============ TEMPLATES ============

export function useMetaTemplates() {
  return useQuery({
    queryKey: ['whatsapp-meta-templates'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('whatsapp_meta_templates')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });
}

export function useCriarMetaTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (template: {
      nome: string;
      categoria: string;
      corpo: string;
      header_tipo?: string;
      header_texto?: string;
      rodape?: string;
      botoes?: any[];
      variaveis_exemplo?: Record<string, string>;
    }) => {
      const { data, error } = await supabase
        .from('whatsapp_meta_templates')
        .insert({
          nome: template.nome,
          categoria: template.categoria,
          corpo: template.corpo,
          header_tipo: template.header_tipo || 'none',
          header_texto: template.header_texto || null,
          rodape: template.rodape || null,
          botoes: template.botoes || null,
          variaveis_exemplo: template.variaveis_exemplo || null,
          status: 'DRAFT',
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['whatsapp-meta-templates'] });
      toast.success('Rascunho salvo!');
    },
    onError: (e: any) => toast.error(e.message || 'Erro ao salvar template'),
  });
}

export function useAtualizarMetaTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...fields }: { id: string } & Record<string, any>) => {
      const { error } = await supabase
        .from('whatsapp_meta_templates')
        .update({ ...fields, updated_at: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['whatsapp-meta-templates'] });
      toast.success('Template atualizado!');
    },
    onError: (e: any) => toast.error(e.message || 'Erro ao atualizar'),
  });
}

export function useEnviarMetaTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (templateId: string) => {
      const { data, error } = await supabase.functions.invoke('whatsapp-meta-templates', {
        body: { acao: 'enviar', template_id: templateId },
      });
      if (error) throw error;
      if (!data.success) throw new Error(data.error);
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['whatsapp-meta-templates'] });
      toast.success('Template enviado para aprovação da Meta!');
    },
    onError: (e: any) => toast.error(e.message || 'Erro ao enviar template'),
  });
}

export function useExcluirMetaTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, nome }: { id: string; nome: string }) => {
      const { data, error } = await supabase.functions.invoke('whatsapp-meta-templates', {
        body: { acao: 'excluir', template_id: id, nome },
      });
      if (error) throw error;
      if (!data.success) throw new Error(data.error);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['whatsapp-meta-templates'] });
      toast.success('Template excluído!');
    },
    onError: (e: any) => toast.error(e.message || 'Erro ao excluir'),
  });
}

export function useSincronizarMetaTemplates() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('whatsapp-meta-templates', {
        body: { acao: 'sincronizar' },
      });
      if (error) throw error;
      if (!data.success) throw new Error(data.error);
      return data;
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['whatsapp-meta-templates'] });
      const msgs: string[] = [];
      if (data.atualizados > 0) msgs.push(`${data.atualizados} atualizados`);
      if (data.novos > 0) msgs.push(`${data.novos} novos importados`);
      toast.success(msgs.length > 0 ? `Templates: ${msgs.join(', ')}` : 'Nenhum template novo encontrado');
    },
    onError: (e: any) => toast.error(e.message || 'Erro ao sincronizar'),
  });
}
