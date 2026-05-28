import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { TUTORIAIS_PADRAO } from '@/data/tutoriais/defaults';

export interface TutorialStepRow {
  id: string;
  tutorial_id: string;
  numero: number;
  titulo: string;
  descricao: string;
  imagem_url: string | null;
  dicas: string[];
  links: { label: string; url: string }[];
}

export interface TutorialRow {
  id: string;
  slug: string;
  titulo: string;
  descricao: string;
  categoria: string;
  tempo_estimado_min: number;
  novo: boolean;
  ordem: number;
  steps: TutorialStepRow[];
}

const QK = ['tutoriais'] as const;

export function useTutoriais() {
  return useQuery({
    queryKey: QK,
    queryFn: async (): Promise<TutorialRow[]> => {
      const { data: tuts, error } = await supabase
        .from('tutoriais')
        .select('*')
        .order('ordem', { ascending: true })
        .order('created_at', { ascending: true });
      if (error) throw error;

      const ids = (tuts ?? []).map((t) => t.id);
      if (ids.length === 0) return [];

      const { data: steps, error: e2 } = await supabase
        .from('tutoriais_steps')
        .select('*')
        .in('tutorial_id', ids)
        .order('numero', { ascending: true });
      if (e2) throw e2;

      const byTut: Record<string, TutorialStepRow[]> = {};
      for (const s of steps ?? []) {
        (byTut[s.tutorial_id] ||= []).push({
          ...s,
          dicas: Array.isArray(s.dicas) ? (s.dicas as string[]) : [],
          links: Array.isArray(s.links) ? (s.links as any[]) : [],
        });
      }
      return (tuts ?? []).map((t) => ({ ...t, steps: byTut[t.id] ?? [] }));
    },
  });
}

export function useTutorialBySlug(slug: string | undefined) {
  const { data, ...rest } = useTutoriais();
  return { ...rest, data: data?.find((t) => t.slug === slug) };
}

export interface TutorialInput {
  id?: string;
  slug: string;
  titulo: string;
  descricao: string;
  categoria: string;
  tempo_estimado_min: number;
  novo: boolean;
  ordem: number;
  steps: Array<{
    id?: string;
    numero: number;
    titulo: string;
    descricao: string;
    imagem_url: string | null;
    dicas: string[];
    links: { label: string; url: string }[];
  }>;
}

export function useSaveTutorial() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: TutorialInput) => {
      const payload = {
        slug: input.slug,
        titulo: input.titulo,
        descricao: input.descricao,
        categoria: input.categoria,
        tempo_estimado_min: input.tempo_estimado_min,
        novo: input.novo,
        ordem: input.ordem,
      };
      let tutorialId = input.id;
      if (tutorialId) {
        const { error } = await supabase.from('tutoriais').update(payload).eq('id', tutorialId);
        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from('tutoriais')
          .insert(payload)
          .select('id')
          .single();
        if (error) throw error;
        tutorialId = data.id;
      }

      // Reescreve steps: deleta os removidos, upsert nos demais
      const { data: existing } = await supabase
        .from('tutoriais_steps')
        .select('id')
        .eq('tutorial_id', tutorialId);
      const keptIds = new Set(input.steps.map((s) => s.id).filter(Boolean) as string[]);
      const toDelete = (existing ?? []).filter((s) => !keptIds.has(s.id)).map((s) => s.id);
      if (toDelete.length > 0) {
        await supabase.from('tutoriais_steps').delete().in('id', toDelete);
      }
      for (const s of input.steps) {
        const row = {
          tutorial_id: tutorialId,
          numero: s.numero,
          titulo: s.titulo,
          descricao: s.descricao,
          imagem_url: s.imagem_url,
          dicas: s.dicas,
          links: s.links,
        };
        if (s.id) {
          const { error } = await supabase.from('tutoriais_steps').update(row).eq('id', s.id);
          if (error) throw error;
        } else {
          const { error } = await supabase.from('tutoriais_steps').insert(row);
          if (error) throw error;
        }
      }
      return tutorialId;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: QK }),
  });
}

export function useDeleteTutorial() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('tutoriais').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: QK }),
  });
}

export function useUploadTutorialImage() {
  return useMutation({
    mutationFn: async (file: File): Promise<string> => {
      const ext = file.name.split('.').pop() ?? 'png';
      const path = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const { error } = await supabase.storage.from('tutoriais').upload(path, file, {
        cacheControl: '3600',
        upsert: false,
      });
      if (error) throw error;
      const { data } = supabase.storage.from('tutoriais').getPublicUrl(path);
      return data.publicUrl;
    },
  });
}

export function useSeedTutoriaisPadrao() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      for (let i = 0; i < TUTORIAIS_PADRAO.length; i++) {
        const t = TUTORIAIS_PADRAO[i];
        // Verifica se já existe pelo slug
        const { data: existing } = await supabase
          .from('tutoriais')
          .select('id')
          .eq('slug', t.slug)
          .maybeSingle();
        if (existing) continue;
        const { data: novo, error } = await supabase
          .from('tutoriais')
          .insert({
            slug: t.slug,
            titulo: t.titulo,
            descricao: t.descricao,
            categoria: t.categoria,
            tempo_estimado_min: t.tempo_estimado_min,
            novo: t.novo ?? false,
            ordem: i,
          })
          .select('id')
          .single();
        if (error) throw error;
        const stepRows = t.steps.map((s) => ({
          tutorial_id: novo.id,
          numero: s.numero,
          titulo: s.titulo,
          descricao: s.descricao,
          imagem_url: s.imagem_url ?? null,
          dicas: s.dicas ?? [],
          links: s.links ?? [],
        }));
        if (stepRows.length > 0) {
          const { error: e2 } = await supabase.from('tutoriais_steps').insert(stepRows);
          if (e2) throw e2;
        }
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: QK }),
  });
}
