import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { DocumentType } from '@/types/canvas-editor';

// ===== QUERIES =====

export function useDocumentTypes() {
  return useQuery({
    queryKey: ['document-types'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('document_types')
        .select('*')
        .eq('is_active', true)
        .order('sort_order');

      if (error) throw error;
      
      return (data || []).map((item) => ({
        ...item,
        required_variables: Array.isArray(item.required_variables) 
          ? item.required_variables as string[]
          : [],
      })) as DocumentType[];
    },
  });
}

export function useDocumentType(id: string | undefined) {
  return useQuery({
    queryKey: ['document-type', id],
    queryFn: async () => {
      if (!id) return null;
      
      const { data, error } = await supabase
        .from('document_types')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;
      
      return {
        ...data,
        required_variables: Array.isArray(data.required_variables) 
          ? data.required_variables as string[]
          : [],
      } as DocumentType;
    },
    enabled: !!id,
  });
}

export function useDocumentTypeByCode(code: string | undefined) {
  return useQuery({
    queryKey: ['document-type-code', code],
    queryFn: async () => {
      if (!code) return null;
      
      const { data, error } = await supabase
        .from('document_types')
        .select('*')
        .eq('code', code)
        .single();

      if (error) throw error;
      
      return {
        ...data,
        required_variables: Array.isArray(data.required_variables) 
          ? data.required_variables as string[]
          : [],
      } as DocumentType;
    },
    enabled: !!code,
  });
}

// ===== MUTATIONS =====

interface UpdateDocTypeInput {
  id: string;
  name?: string;
  description?: string;
  is_active?: boolean;
  sort_order?: number;
}

export function useUpdateDocumentType() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...input }: UpdateDocTypeInput) => {
      const { data, error } = await supabase
        .from('document_types')
        .update({
          ...input,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['document-types'] });
      toast.success('Tipo de documento atualizado!');
    },
    onError: (error: Error) => {
      console.error('Erro ao atualizar tipo:', error);
      toast.error('Erro ao atualizar tipo de documento');
    },
  });
}

export function useToggleDocumentTypeActive() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { data, error } = await supabase
        .from('document_types')
        .update({
          is_active,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['document-types'] });
      toast.success(variables.is_active 
        ? 'Tipo de documento ativado!' 
        : 'Tipo de documento desativado!'
      );
    },
    onError: (error: Error) => {
      console.error('Erro ao alterar status:', error);
      toast.error('Erro ao alterar status do tipo');
    },
  });
}

// ===== TEMPLATES POR TIPO =====

export function useTemplatesByDocumentType(documentTypeId: string | undefined) {
  return useQuery({
    queryKey: ['templates-by-type', documentTypeId],
    queryFn: async () => {
      if (!documentTypeId) return [];
      
      const { data, error } = await supabase
        .from('documento_templates')
        .select('*')
        .eq('document_type_id', documentTypeId)
        .eq('ativo', true)
        .order('is_default', { ascending: false })
        .order('nome');

      if (error) throw error;
      return data || [];
    },
    enabled: !!documentTypeId,
  });
}

export function useDefaultTemplateForType(documentTypeCode: string | undefined) {
  return useQuery({
    queryKey: ['default-template', documentTypeCode],
    queryFn: async () => {
      if (!documentTypeCode) return null;
      
      // Primeiro buscar o tipo pelo código
      const { data: docType, error: typeError } = await supabase
        .from('document_types')
        .select('id')
        .eq('code', documentTypeCode)
        .single();

      if (typeError) throw typeError;
      
      // Buscar template padrão
      const { data, error } = await supabase
        .from('documento_templates')
        .select('*')
        .eq('document_type_id', docType.id)
        .eq('is_default', true)
        .eq('ativo', true)
        .single();

      if (error && error.code !== 'PGRST116') throw error;
      return data || null;
    },
    enabled: !!documentTypeCode,
  });
}

export function useSetDefaultTemplate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ templateId, documentTypeId }: { templateId: string; documentTypeId: string }) => {
      // Transação: remover padrão anterior e definir novo
      // 1. Remover padrão anterior
      const { error: clearError } = await supabase
        .from('documento_templates')
        .update({ is_default: false, status: 'active' as const })
        .eq('document_type_id', documentTypeId)
        .eq('is_default', true);

      if (clearError) throw clearError;

      // 2. Definir novo padrão
      const { data, error } = await supabase
        .from('documento_templates')
        .update({ 
          is_default: true,
          status: 'active' as const, // Garantir que está ativo
        })
        .eq('id', templateId)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['templates-by-type'] });
      queryClient.invalidateQueries({ queryKey: ['default-template'] });
      queryClient.invalidateQueries({ queryKey: ['documento-templates'] });
      toast.success('Template padrão definido com sucesso!');
    },
    onError: (error: Error) => {
      console.error('Erro ao definir template padrão:', error);
      toast.error('Erro ao definir template padrão');
    },
  });
}

// ===== CONTAGEM DE TEMPLATES POR TIPO =====

export function useTemplateCountByType() {
  return useQuery({
    queryKey: ['template-count-by-type'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('documento_templates')
        .select('document_type_id')
        .eq('ativo', true);

      if (error) throw error;
      
      // Contar templates por tipo
      const counts: Record<string, number> = {};
      (data || []).forEach((template) => {
        if (template.document_type_id) {
          counts[template.document_type_id] = (counts[template.document_type_id] || 0) + 1;
        }
      });
      
      return counts;
    },
  });
}
