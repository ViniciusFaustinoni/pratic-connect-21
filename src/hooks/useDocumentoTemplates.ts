import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { DocumentoCategoria, ConfiguracaoLayout, VariavelTemplate } from '@/types/documentos';
import type { Json } from '@/integrations/supabase/types';
import type { CanvasData, TemplateStatus } from '@/types/canvas-editor';

// Tipo que representa o template como vem do banco
interface TemplateFromDB {
  id: string;
  categoria_id: string;
  nome: string;
  codigo: string;
  descricao: string;
  versao: number;
  conteudo: string;
  variaveis: Json;
  config_layout: Json;
  cabecalho_html: string;
  rodape_html: string;
  ativo: boolean;
  requer_assinatura: boolean;
  created_by: string;
  created_at: string;
  updated_at: string;
  // Novos campos do editor visual
  canvas_data?: Json;
  document_type_id?: string;
  is_default?: boolean;
  status?: string;
  thumbnail_url?: string;
  // Campos para integração com Autentique
  is_default_autentique?: boolean;
  template_html?: string;
  is_default_evento?: boolean;
  is_default_saida?: boolean;
  is_default_rastreador?: boolean;
}

// Tipo transformado para uso no frontend
export interface DocumentoTemplateView {
  id: string;
  categoria_id: string;
  nome: string;
  codigo: string;
  descricao?: string;
  versao: number;
  conteudo: string;
  variaveis: VariavelTemplate[];
  config_layout: ConfiguracaoLayout;
  cabecalho_html?: string;
  rodape_html?: string;
  ativo: boolean;
  requer_assinatura: boolean;
  created_by?: string;
  created_at: string;
  updated_at: string;
  // Novos campos do editor visual
  canvas_data?: CanvasData | null;
  document_type_id?: string;
  is_default?: boolean;
  status?: TemplateStatus;
  thumbnail_url?: string;
  // Campos para integração com Autentique
  is_default_autentique?: boolean;
  template_html?: string;
  is_default_evento?: boolean;
  is_default_saida?: boolean;
  is_default_rastreador?: boolean;
}

// Função para transformar dados do banco para o tipo do frontend
function transformTemplate(data: TemplateFromDB & { categoria: DocumentoCategoria | null }): DocumentoTemplateView & { categoria: DocumentoCategoria } {
  return {
    ...data,
    descricao: data.descricao || undefined,
    variaveis: Array.isArray(data.variaveis) ? (data.variaveis as unknown as VariavelTemplate[]) : [],
    config_layout: data.config_layout as unknown as ConfiguracaoLayout,
    cabecalho_html: data.cabecalho_html || undefined,
    rodape_html: data.rodape_html || undefined,
    created_by: data.created_by || undefined,
    categoria: data.categoria as DocumentoCategoria,
    // Novos campos
    canvas_data: data.canvas_data ? (data.canvas_data as unknown as CanvasData) : null,
    document_type_id: data.document_type_id || undefined,
    is_default: data.is_default || false,
    status: (data.status as TemplateStatus) || 'draft',
    thumbnail_url: data.thumbnail_url || undefined,
    // Campos Autentique
    is_default_autentique: data.is_default_autentique || false,
    template_html: data.template_html || undefined,
    is_default_evento: data.is_default_evento || false,
    is_default_saida: (data as any).is_default_saida || false,
    is_default_rastreador: (data as any).is_default_rastreador || false,
  };
}

// ===== QUERIES =====

export function useDocumentoTemplates() {
  return useQuery({
    queryKey: ['documento-templates'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('documento_templates')
        .select(`
          *,
          categoria:documento_categorias(*)
        `)
        .eq('ativo', true)
        .order('categoria_id')
        .order('nome');

      if (error) throw error;
      return (data || []).map(item => transformTemplate(item as any));
    },
  });
}

export function useDocumentoTemplate(id: string | undefined) {
  return useQuery({
    queryKey: ['documento-template', id],
    queryFn: async () => {
      if (!id) return null;
      
      const { data, error } = await supabase
        .from('documento_templates')
        .select(`
          *,
          categoria:documento_categorias(*)
        `)
        .eq('id', id)
        .single();

      if (error) throw error;
      return transformTemplate(data as any);
    },
    enabled: !!id,
  });
}

export function useDocumentoCategorias() {
  return useQuery({
    queryKey: ['documento-categorias'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('documento_categorias')
        .select('*')
        .eq('ativo', true)
        .order('ordem');

      if (error) throw error;
      return data as DocumentoCategoria[];
    },
  });
}

// ===== MUTATIONS =====

interface CreateTemplateInput {
  codigo: string;
  nome: string;
  descricao?: string;
  categoria_id: string;
  conteudo: string;
  variaveis?: VariavelTemplate[];
  requer_assinatura?: boolean;
  config_layout?: ConfiguracaoLayout;
  // Novos campos do editor visual
  canvas_data?: CanvasData;
  document_type_id?: string;
  is_default?: boolean;
  status?: TemplateStatus;
  is_default_autentique?: boolean;
  is_default_evento?: boolean;
  is_default_saida?: boolean;
  is_default_rastreador?: boolean;
}

export function useCreateTemplate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateTemplateInput) => {
      // Garantir exclusividade do is_default_rastreador
      if (input.is_default_rastreador) {
        await supabase
          .from('documento_templates')
          .update({ is_default_rastreador: false } as any)
          .eq('is_default_rastreador', true);
      }

      const { data, error } = await supabase
        .from('documento_templates')
        .insert({
          codigo: input.codigo,
          nome: input.nome,
          descricao: input.descricao || '',
          categoria_id: input.categoria_id,
          conteudo: input.conteudo,
          variaveis: (input.variaveis || []) as unknown as Json,
          requer_assinatura: input.requer_assinatura || false,
          config_layout: (input.config_layout || {}) as unknown as Json,
          versao: 1,
          ativo: true,
          // Novos campos
          canvas_data: input.canvas_data ? (input.canvas_data as unknown as Json) : null,
          document_type_id: input.document_type_id || null,
          is_default: input.is_default || false,
          status: input.status || 'draft',
          is_default_autentique: input.is_default_autentique || false,
          is_default_evento: input.is_default_evento || false,
          is_default_saida: input.is_default_saida || false,
          is_default_rastreador: input.is_default_rastreador || false,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['documento-templates'] });
      toast.success('Template criado com sucesso!');
    },
    onError: (error: any) => {
      console.error('Erro ao criar template:', error);
      if (error?.code === '23505') {
        toast.error('Já existe um template com este código. Escolha outro.');
      } else {
        toast.error('Erro ao criar template');
      }
    },
  });
}

interface UpdateTemplateInput {
  id: string;
  codigo?: string;
  nome?: string;
  descricao?: string;
  categoria_id?: string;
  conteudo?: string;
  variaveis?: VariavelTemplate[];
  requer_assinatura?: boolean;
  config_layout?: ConfiguracaoLayout;
  // Novos campos do editor visual
  canvas_data?: CanvasData;
  document_type_id?: string;
  is_default?: boolean;
  status?: TemplateStatus;
  is_default_autentique?: boolean;
  is_default_evento?: boolean;
  is_default_saida?: boolean;
  is_default_rastreador?: boolean;
}

export function useUpdateTemplate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...input }: UpdateTemplateInput) => {
      // Garantir exclusividade do is_default_rastreador
      if (input.is_default_rastreador) {
        await supabase
          .from('documento_templates')
          .update({ is_default_rastreador: false } as any)
          .eq('is_default_rastreador', true)
          .neq('id', id);
      }

      const updateData: Record<string, unknown> = {
        updated_at: new Date().toISOString(),
      };

      if (input.codigo !== undefined) updateData.codigo = input.codigo;
      if (input.nome !== undefined) updateData.nome = input.nome;
      if (input.descricao !== undefined) updateData.descricao = input.descricao;
      if (input.categoria_id !== undefined) updateData.categoria_id = input.categoria_id;
      if (input.conteudo !== undefined) updateData.conteudo = input.conteudo;
      if (input.variaveis !== undefined) updateData.variaveis = input.variaveis as unknown as Json;
      if (input.requer_assinatura !== undefined) updateData.requer_assinatura = input.requer_assinatura;
      if (input.config_layout !== undefined) updateData.config_layout = input.config_layout as unknown as Json;
      // Novos campos
      if (input.canvas_data !== undefined) updateData.canvas_data = input.canvas_data as unknown as Json;
      if (input.document_type_id !== undefined) updateData.document_type_id = input.document_type_id;
      if (input.is_default !== undefined) updateData.is_default = input.is_default;
      if (input.status !== undefined) updateData.status = input.status;
      if (input.is_default_autentique !== undefined) updateData.is_default_autentique = input.is_default_autentique;
      if (input.is_default_evento !== undefined) updateData.is_default_evento = input.is_default_evento;
      if (input.is_default_saida !== undefined) updateData.is_default_saida = input.is_default_saida;
      if (input.is_default_rastreador !== undefined) updateData.is_default_rastreador = input.is_default_rastreador;

      const { data, error } = await supabase
        .from('documento_templates')
        .update(updateData)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['documento-templates'] });
      toast.success('Template atualizado com sucesso!');
    },
    onError: (error: Error) => {
      console.error('Erro ao atualizar template:', error);
      toast.error('Erro ao atualizar template');
    },
  });
}

export function useDeleteTemplate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      // Soft delete - apenas marca como inativo
      const { error } = await supabase
        .from('documento_templates')
        .update({ ativo: false, updated_at: new Date().toISOString() })
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['documento-templates'] });
      toast.success('Template excluído com sucesso!');
    },
    onError: (error: Error) => {
      console.error('Erro ao excluir template:', error);
      toast.error('Erro ao excluir template');
    },
  });
}

export function useDuplicateTemplate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      // Buscar template original
      const { data: original, error: fetchError } = await supabase
        .from('documento_templates')
        .select('*')
        .eq('id', id)
        .single();

      if (fetchError) throw fetchError;

      // Criar cópia com novo código
      const { data, error } = await supabase
        .from('documento_templates')
        .insert({
          codigo: `${original.codigo}-COPIA`,
          nome: `${original.nome} (Cópia)`,
          descricao: original.descricao,
          categoria_id: original.categoria_id,
          conteudo: original.conteudo,
          variaveis: original.variaveis,
          requer_assinatura: original.requer_assinatura,
          config_layout: original.config_layout,
          versao: 1,
          ativo: true,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['documento-templates'] });
      toast.success('Template duplicado com sucesso!');
    },
    onError: (error: Error) => {
      console.error('Erro ao duplicar template:', error);
      toast.error('Erro ao duplicar template');
    },
  });
}
