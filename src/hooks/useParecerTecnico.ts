import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface ParecerTecnico {
  id: string;
  sinistro_id: string;
  vistoria_id: string | null;
  regulador_id: string;
  gravidade: 'leve' | 'moderado' | 'grave' | 'possivel_perda_total';
  descricao_tecnica: string;
  prazo_estimado: string | null;
  prazo_observacao: string | null;
  observacoes_gerais: string | null;
  recomendacao: string | null;
  estimativa_total: number;
  created_at: string;
  regulador_nome?: string;
}

export interface ParecerTecnicoItem {
  id: string;
  parecer_id: string;
  tipo: 'peca' | 'servico';
  descricao: string;
  origem_sugerida: string | null;
  quantidade: number;
  valor_estimado: number;
  prioridade: 'essencial' | 'necessario' | 'opcional';
  observacao: string | null;
  created_at: string;
}

export interface ParecerTecnicoFoto {
  id: string;
  parecer_id: string;
  arquivo_url: string;
  descricao: string | null;
  created_at: string;
}

export function useParecerTecnico(sinistroId: string | undefined) {
  return useQuery({
    queryKey: ['parecer-tecnico', sinistroId],
    queryFn: async () => {
      if (!sinistroId) return null;
      const { data, error } = await supabase
        .from('parecer_tecnico_regulador' as any)
        .select('*, profiles:regulador_id(nome)')
        .eq('sinistro_id', sinistroId)
        .maybeSingle();
      if (error) throw error;
      if (!data) return null;
      const d = data as any;
      return {
        id: d.id,
        sinistro_id: d.sinistro_id,
        vistoria_id: d.vistoria_id,
        regulador_id: d.regulador_id,
        gravidade: d.gravidade,
        descricao_tecnica: d.descricao_tecnica,
        prazo_estimado: d.prazo_estimado,
        prazo_observacao: d.prazo_observacao,
        observacoes_gerais: d.observacoes_gerais,
        recomendacao: d.recomendacao,
        estimativa_total: d.estimativa_total,
        created_at: d.created_at,
        regulador_nome: d.profiles?.nome || 'Regulador',
      } as ParecerTecnico;
    },
    enabled: !!sinistroId,
  });
}

export function useParecerTecnicoItens(parecerId: string | undefined) {
  return useQuery({
    queryKey: ['parecer-tecnico-itens', parecerId],
    queryFn: async () => {
      if (!parecerId) return [];
      const { data, error } = await supabase
        .from('parecer_tecnico_itens' as any)
        .select('*')
        .eq('parecer_id', parecerId)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return (data || []) as unknown as ParecerTecnicoItem[];
    },
    enabled: !!parecerId,
  });
}

export function useParecerTecnicoFotos(parecerId: string | undefined) {
  return useQuery({
    queryKey: ['parecer-tecnico-fotos', parecerId],
    queryFn: async () => {
      if (!parecerId) return [];
      const { data, error } = await supabase
        .from('parecer_tecnico_fotos' as any)
        .select('*')
        .eq('parecer_id', parecerId)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return (data || []) as unknown as ParecerTecnicoFoto[];
    },
    enabled: !!parecerId,
  });
}

export function useSalvarParecerTecnico() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      sinistroId,
      vistoriaId,
      reguladorId,
      parecer,
      itens,
    }: {
      sinistroId: string;
      vistoriaId?: string;
      reguladorId: string;
      parecer: {
        gravidade: string;
        descricao_tecnica: string;
        prazo_estimado?: string;
        prazo_observacao?: string;
        observacoes_gerais?: string;
        recomendacao?: string;
        estimativa_total: number;
      };
      itens: Array<{
        tipo: string;
        descricao: string;
        origem_sugerida?: string;
        quantidade: number;
        valor_estimado: number;
        prioridade: string;
        observacao?: string;
      }>;
    }) => {
      // Insert parecer
      const { data: parecerData, error: parecerError } = await supabase
        .from('parecer_tecnico_regulador' as any)
        .insert({
          sinistro_id: sinistroId,
          vistoria_id: vistoriaId || null,
          regulador_id: reguladorId,
          ...parecer,
        })
        .select()
        .single();
      if (parecerError) throw parecerError;

      // Insert itens
      if (itens.length > 0) {
        const itensToInsert = itens.map(item => ({
          parecer_id: (parecerData as any).id,
          ...item,
        }));
        const { error: itensError } = await supabase
          .from('parecer_tecnico_itens' as any)
          .insert(itensToInsert);
        if (itensError) throw itensError;
      }

      return parecerData;
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ['parecer-tecnico', vars.sinistroId] });
      queryClient.invalidateQueries({ queryKey: ['parecer-tecnico-itens'] });
    },
  });
}

export function useUploadFotoParecer() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      parecerId,
      sinistroId,
      arquivo,
      descricao,
    }: {
      parecerId: string;
      sinistroId: string;
      arquivo: File;
      descricao?: string;
    }) => {
      const ext = arquivo.name.split('.').pop() || 'jpg';
      const path = `${sinistroId}/parecer-tecnico/${Date.now()}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from('sinistro-eventos')
        .upload(path, arquivo, { contentType: arquivo.type, upsert: true });
      if (uploadError) throw uploadError;

      const { data: signedData } = await supabase.storage
        .from('sinistro-eventos')
        .createSignedUrl(path, 60 * 60 * 24 * 365);

      const url = signedData?.signedUrl || path;

      const { data, error } = await supabase
        .from('parecer_tecnico_fotos' as any)
        .insert({ parecer_id: parecerId, arquivo_url: url, descricao: descricao || null })
        .select()
        .single();
      if (error) throw error;
      return data as unknown as ParecerTecnicoFoto;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['parecer-tecnico-fotos'] });
    },
  });
}
