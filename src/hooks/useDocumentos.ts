import { useQuery } from '@tanstack/react-query';
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
