import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export type IAAudiencia = 'lead' | 'associado' | 'diretor';

export interface IAHabilidade {
  slug: string;
  nome_exibicao: string;
  descricao: string | null;
  ativa: boolean;
  nome_agente: string;
  persona: string;
  regras_absolutas: string;
  tom_voz: string;
  saudacao_inicial: string;
  audiencias_elegiveis: string[];
  ferramentas_habilitadas: string[];
  prioridade_roteamento: number;
  horario_atendimento: any | null;
  mensagem_fora_horario: string | null;
  atualizado_em: string;
}

export interface IAConhecimento {
  id: string;
  habilidade_slug: string;
  categoria: string;
  pergunta: string;
  resposta: string;
  palavras_chave: string[];
  ordem: number;
  ativo: boolean;
  revisar: boolean;
  atualizado_em: string;
}

export interface IAExemplo {
  id: string;
  habilidade_slug: string;
  titulo: string;
  entrada_usuario: string;
  resposta_ideal: string;
  notas: string | null;
  ordem: number;
  ativo: boolean;
  atualizado_em: string;
}

// ─── Habilidades ──────────────────────────────────────────────
export function useIAHabilidades() {
  return useQuery({
    queryKey: ['ia-habilidades'],
    queryFn: async (): Promise<IAHabilidade[]> => {
      const { data, error } = await (supabase as any)
        .from('ia_habilidades')
        .select('*')
        .order('prioridade_roteamento');
      if (error) throw error;
      return (data || []) as IAHabilidade[];
    },
  });
}

export function useUpsertIAHabilidade() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: Partial<IAHabilidade> & { slug: string }) => {
      const { error } = await (supabase as any)
        .from('ia_habilidades')
        .upsert(payload, { onConflict: 'slug' });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ia-habilidades'] });
      toast.success('Habilidade atualizada.');
    },
    onError: (e: any) => toast.error('Erro: ' + (e?.message || 'desconhecido')),
  });
}

export function useToggleIAHabilidade() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ slug, ativa }: { slug: string; ativa: boolean }) => {
      const { error } = await (supabase as any)
        .from('ia_habilidades')
        .update({ ativa })
        .eq('slug', slug);
      if (error) throw error;
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ['ia-habilidades'] });
      toast.success(vars.ativa ? 'Habilidade ativada.' : 'Habilidade desativada.');
    },
    onError: (e: any) => toast.error('Erro: ' + (e?.message || 'desconhecido')),
  });
}

// ─── Conhecimento ─────────────────────────────────────────────
export function useIAConhecimento(habilidadeSlug?: string) {
  return useQuery({
    queryKey: ['ia-conhecimento', habilidadeSlug],
    enabled: !!habilidadeSlug,
    queryFn: async (): Promise<IAConhecimento[]> => {
      const { data, error } = await (supabase as any)
        .from('ia_habilidade_conhecimento')
        .select('*')
        .eq('habilidade_slug', habilidadeSlug)
        .order('categoria')
        .order('ordem');
      if (error) throw error;
      return (data || []) as IAConhecimento[];
    },
  });
}

export function useUpsertIAConhecimento() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: Partial<IAConhecimento>) => {
      const { error } = await (supabase as any)
        .from('ia_habilidade_conhecimento')
        .upsert(payload);
      if (error) throw error;
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ['ia-conhecimento', vars.habilidade_slug] });
      toast.success('Conhecimento salvo.');
    },
    onError: (e: any) => toast.error('Erro: ' + (e?.message || 'desconhecido')),
  });
}

export function useDeleteIAConhecimento() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any)
        .from('ia_habilidade_conhecimento')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ia-conhecimento'] });
      toast.success('Removido.');
    },
    onError: (e: any) => toast.error('Erro: ' + (e?.message || 'desconhecido')),
  });
}

// ─── Exemplos ─────────────────────────────────────────────────
export function useIAExemplos(habilidadeSlug?: string) {
  return useQuery({
    queryKey: ['ia-exemplos', habilidadeSlug],
    enabled: !!habilidadeSlug,
    queryFn: async (): Promise<IAExemplo[]> => {
      const { data, error } = await (supabase as any)
        .from('ia_habilidade_exemplos')
        .select('*')
        .eq('habilidade_slug', habilidadeSlug)
        .order('ordem');
      if (error) throw error;
      return (data || []) as IAExemplo[];
    },
  });
}

export function useUpsertIAExemplo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: Partial<IAExemplo>) => {
      const { error } = await (supabase as any)
        .from('ia_habilidade_exemplos')
        .upsert(payload);
      if (error) throw error;
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ['ia-exemplos', vars.habilidade_slug] });
      toast.success('Exemplo salvo.');
    },
    onError: (e: any) => toast.error('Erro: ' + (e?.message || 'desconhecido')),
  });
}

export function useDeleteIAExemplo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any)
        .from('ia_habilidade_exemplos')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ia-exemplos'] });
      toast.success('Removido.');
    },
    onError: (e: any) => toast.error('Erro: ' + (e?.message || 'desconhecido')),
  });
}
