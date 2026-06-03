import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export type MayaAudiencia = 'associado' | 'lead' | 'diretor';

export interface MayaComportamento {
  audiencia: MayaAudiencia;
  nome_agente: string;
  persona: string;
  regras_absolutas: string;
  tom_voz: string;
  saudacao_inicial: string;
  atualizado_em: string;
  atualizado_por: string | null;
}

export interface MayaFaq {
  id: string;
  categoria: string;
  pergunta: string;
  resposta: string;
  palavras_chave: string[];
  audiencias: string[];
  ativo: boolean;
  ordem: number;
  atualizado_em: string;
  atualizado_por: string | null;
}

export function useMayaComportamento(audiencia: MayaAudiencia) {
  return useQuery({
    queryKey: ['maya-comportamento', audiencia],
    queryFn: async (): Promise<MayaComportamento | null> => {
      const { data, error } = await (supabase as any)
        .from('maya_ia_comportamento')
        .select('*')
        .eq('audiencia', audiencia)
        .maybeSingle();
      if (error) throw error;
      return data as MayaComportamento | null;
    },
  });
}

export function useSaveMayaComportamento() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: Partial<MayaComportamento> & { audiencia: MayaAudiencia }) => {
      const { error } = await (supabase as any)
        .from('maya_ia_comportamento')
        .upsert(payload, { onConflict: 'audiencia' });
      if (error) throw error;
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ['maya-comportamento', vars.audiencia] });
      toast.success('Comportamento atualizado. A Maya começa a usar em até 60s.');
    },
    onError: (e: any) => toast.error('Não foi possível salvar: ' + (e.message || 'erro desconhecido')),
  });
}

export function useMayaFaq() {
  return useQuery({
    queryKey: ['maya-faq'],
    queryFn: async (): Promise<MayaFaq[]> => {
      const { data, error } = await (supabase as any)
        .from('maya_ia_faq')
        .select('*')
        .order('categoria', { ascending: true })
        .order('ordem', { ascending: true });
      if (error) throw error;
      return (data || []) as MayaFaq[];
    },
  });
}

export function useUpsertMayaFaq() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: Partial<MayaFaq>) => {
      const { error } = await (supabase as any).from('maya_ia_faq').upsert(payload);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['maya-faq'] });
      toast.success('Conhecimento salvo.');
    },
    onError: (e: any) => toast.error('Erro: ' + (e.message || 'desconhecido')),
  });
}

export function useDeleteMayaFaq() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).from('maya_ia_faq').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['maya-faq'] });
      toast.success('Conhecimento removido.');
    },
    onError: (e: any) => toast.error('Erro: ' + (e.message || 'desconhecido')),
  });
}
