import { useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { publicSupabase } from '@/integrations/supabase/publicClient';
import { toast } from 'sonner';

export interface DataBloqueada {
  id: string;
  data: string; // yyyy-MM-dd
  motivo: string;
  criado_por: string | null;
  created_at: string;
  updated_at: string;
}

const QUERY_KEY = ['datas-bloqueadas'] as const;

/**
 * Lista todas as datas bloqueadas. Usa cliente público (anon) para funcionar
 * tanto no painel autenticado quanto no fluxo público de cotação/contrato.
 */
export function useDatasBloqueadas() {
  return useQuery({
    queryKey: QUERY_KEY,
    queryFn: async () => {
      const { data, error } = await publicSupabase
        .from('datas_bloqueadas')
        .select('*')
        .order('data', { ascending: true });
      if (error) throw error;
      return (data || []) as DataBloqueada[];
    },
    staleTime: 2 * 60 * 1000,
  });
}

/** Retorna um Set de datas bloqueadas (yyyy-MM-dd) para checagem O(1). */
export function useDatasBloqueadasSet(): {
  set: Set<string>;
  motivosMap: Map<string, string>;
  isLoading: boolean;
} {
  const { data, isLoading } = useDatasBloqueadas();
  return useMemo(() => {
    const set = new Set<string>();
    const motivosMap = new Map<string, string>();
    (data || []).forEach((d) => {
      set.add(d.data);
      motivosMap.set(d.data, d.motivo);
    });
    return { set, motivosMap, isLoading };
  }, [data, isLoading]);
}

/** Helper: data está bloqueada? */
export function isDataBloqueada(date: Date | string, set: Set<string>): boolean {
  const key = typeof date === 'string' ? date : format(date, 'yyyy-MM-dd');
  return set.has(key);
}

interface BloquearDataInput {
  data: string; // yyyy-MM-dd
  motivo: string;
}

export function useBloquearData() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ data, motivo }: BloquearDataInput) => {
      const { data: userData } = await supabase.auth.getUser();
      const { error } = await supabase
        .from('datas_bloqueadas')
        .insert({
          data,
          motivo,
          criado_por: userData?.user?.id ?? null,
        });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Data bloqueada com sucesso');
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: ['vagas-periodo'] });
    },
    onError: (error: any) => {
      toast.error(error?.message || 'Erro ao bloquear data');
    },
  });
}

export function useDesbloquearData() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: string) => {
      const { error } = await supabase
        .from('datas_bloqueadas')
        .delete()
        .eq('data', data);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Data desbloqueada');
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: ['vagas-periodo'] });
    },
    onError: (error: any) => {
      toast.error(error?.message || 'Erro ao desbloquear data');
    },
  });
}

/**
 * Detecta erro de trigger `DATA_BLOQUEADA:` vindo do banco e devolve mensagem amigável.
 * Retorna null se não for esse tipo de erro.
 */
export function parseDataBloqueadaError(error: any): string | null {
  const msg = error?.message || error?.error_description || '';
  if (typeof msg === 'string' && msg.includes('DATA_BLOQUEADA')) {
    // Extrai motivo se estiver no padrão do trigger
    const motivoMatch = msg.match(/Motivo:\s*(.+)$/);
    const motivo = motivoMatch?.[1]?.trim();
    return motivo
      ? `Data bloqueada pelo coordenador: ${motivo}. Escolha outra data.`
      : 'Esta data foi bloqueada pelo coordenador. Escolha outra data.';
  }
  return null;
}
