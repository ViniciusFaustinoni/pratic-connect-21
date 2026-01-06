import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Tables, TablesInsert, TablesUpdate } from '@/integrations/supabase/types';

type Cotacao = Tables<'cotacoes'>;
type CotacaoInsert = TablesInsert<'cotacoes'>;
type CotacaoUpdate = TablesUpdate<'cotacoes'>;

// Gera número único para cotação: COT-YYYYMMDD-HHMMSSMMM-XXX
function gerarNumeroCotacao(): string {
  const now = new Date();
  const ano = now.getFullYear();
  const mes = String(now.getMonth() + 1).padStart(2, '0');
  const dia = String(now.getDate()).padStart(2, '0');
  const hora = String(now.getHours()).padStart(2, '0');
  const min = String(now.getMinutes()).padStart(2, '0');
  const seg = String(now.getSeconds()).padStart(2, '0');
  const ms = String(now.getMilliseconds()).padStart(3, '0');
  const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
  
  return `COT-${ano}${mes}${dia}-${hora}${min}${seg}${ms}-${random}`;
}

export interface CotacaoWithRelations extends Cotacao {
  leads?: Tables<'leads'> | null;
  planos?: Tables<'planos'> | null;
}

export function useCotacoes() {
  return useQuery({
    queryKey: ['cotacoes'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('cotacoes')
        .select(`
          *,
          leads (*),
          planos (*)
        `)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data as CotacaoWithRelations[];
    },
  });
}

export function useCotacao(id: string | undefined) {
  return useQuery({
    queryKey: ['cotacoes', id],
    queryFn: async () => {
      if (!id) throw new Error('ID é obrigatório');
      
      const { data, error } = await supabase
        .from('cotacoes')
        .select(`
          *,
          leads (*),
          planos (*)
        `)
        .eq('id', id)
        .single();
      
      if (error) throw error;
      return data as CotacaoWithRelations;
    },
    enabled: !!id,
  });
}

export function useCreateCotacao() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (cotacao: Omit<CotacaoInsert, 'numero'>) => {
      const { data, error } = await supabase
        .from('cotacoes')
        .insert({
          ...cotacao,
          numero: gerarNumeroCotacao(),
        })
        .select()
        .single();
      
      if (error) throw error;
      return data as Cotacao;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cotacoes'] });
    },
  });
}

export function useUpdateCotacao() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, ...updates }: CotacaoUpdate & { id: string }) => {
      const { data, error } = await supabase
        .from('cotacoes')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return data as Cotacao;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['cotacoes'] });
      queryClient.invalidateQueries({ queryKey: ['cotacoes', data.id] });
    },
  });
}
