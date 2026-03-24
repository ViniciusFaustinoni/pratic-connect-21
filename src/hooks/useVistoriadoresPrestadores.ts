import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface VistoriadorPrestador {
  id: string;
  nome: string;
  telefone: string | null;
  email: string | null;
  cpf_cnpj: string | null;
  ativo: boolean;
  observacoes: string | null;
  created_at: string;
  updated_at: string;
}

type VistoriadorPrestadorInput = Omit<VistoriadorPrestador, 'id' | 'created_at' | 'updated_at'>;

const QUERY_KEY = ['vistoriadores-prestadores'];

export function useVistoriadoresPrestadores() {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: QUERY_KEY,
    queryFn: async (): Promise<VistoriadorPrestador[]> => {
      const { data, error } = await (supabase as any)
        .from('vistoriadores_prestadores')
        .select('*')
        .order('nome');
      if (error) throw error;
      return data ?? [];
    },
  });

  const criar = useMutation({
    mutationFn: async (input: VistoriadorPrestadorInput) => {
      const { error } = await (supabase as any)
        .from('vistoriadores_prestadores')
        .insert(input);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
      toast.success('Vistoriador prestador cadastrado');
    },
    onError: (e: Error) => toast.error('Erro: ' + e.message),
  });

  const editar = useMutation({
    mutationFn: async ({ id, ...input }: Partial<VistoriadorPrestador> & { id: string }) => {
      const { error } = await (supabase as any)
        .from('vistoriadores_prestadores')
        .update({ ...input, updated_at: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
      toast.success('Vistoriador prestador atualizado');
    },
    onError: (e: Error) => toast.error('Erro: ' + e.message),
  });

  const toggleAtivo = useMutation({
    mutationFn: async ({ id, ativo }: { id: string; ativo: boolean }) => {
      const { error } = await (supabase as any)
        .from('vistoriadores_prestadores')
        .update({ ativo, updated_at: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
      toast.success('Status atualizado');
    },
    onError: (e: Error) => toast.error('Erro: ' + e.message),
  });

  return { ...query, criar, editar, toggleAtivo };
}
