import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Tables } from '@/integrations/supabase/types';

type Documento = Tables<'documentos'>;

export interface DocumentoWithRelations extends Documento {
  associados?: {
    nome: string;
  } | null;
}

export function useDocumentos() {
  return useQuery({
    queryKey: ['documentos'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('documentos')
        .select(`
          *,
          associados (
            nome
          )
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as DocumentoWithRelations[];
    },
  });
}

export function usePendingDocumentos() {
  return useQuery({
    queryKey: ['documentos', 'pending'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('documentos')
        .select(`
          *,
          associados (
            nome
          )
        `)
        .in('status', ['pendente', 'em_analise'])
        .order('created_at', { ascending: false })
        .limit(10);

      if (error) throw error;
      return data as DocumentoWithRelations[];
    },
  });
}

export function useDocumento(id: string | undefined) {
  return useQuery({
    queryKey: ['documentos', 'detail', id],
    queryFn: async () => {
      if (!id) throw new Error('ID é obrigatório');

      const { data, error } = await supabase
        .from('documentos')
        .select(`
          *,
          associados (
            nome
          )
        `)
        .eq('id', id)
        .single();

      if (error) throw error;
      return data as DocumentoWithRelations;
    },
    enabled: !!id,
  });
}

export function useDocumentosByAssociado(associadoId: string | undefined) {
  return useQuery({
    queryKey: ['documentos', 'associado', associadoId],
    queryFn: async () => {
      if (!associadoId) return [];

      const { data, error } = await supabase
        .from('documentos')
        .select('*')
        .eq('associado_id', associadoId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as Documento[];
    },
    enabled: !!associadoId,
  });
}

export function useAnaliseDocumento() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      status,
      motivo_reprovacao,
    }: {
      id: string;
      status: 'aprovado' | 'reprovado';
      motivo_reprovacao?: string;
    }) => {
      const { data: { user } } = await supabase.auth.getUser();

      // Get profile ID for the analyst
      const { data: profile } = await supabase
        .from('profiles')
        .select('id')
        .eq('user_id', user?.id || '')
        .maybeSingle();

      const { data, error } = await supabase
        .from('documentos')
        .update({
          status,
          motivo_reprovacao: status === 'reprovado' ? motivo_reprovacao : null,
          analista_id: profile?.id,
          data_analise: new Date().toISOString(),
        })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['documentos'] });
      queryClient.invalidateQueries({ queryKey: ['documentos', 'detail', data.id] });
      queryClient.invalidateQueries({ queryKey: ['documentos', 'associado', data.associado_id] });
    },
  });
}
