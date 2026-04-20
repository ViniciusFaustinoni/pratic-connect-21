import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export type PrestadorOrigem = 'vistoriador_prestador' | 'prestador_instalacao';

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
  origem?: PrestadorOrigem;
}

type VistoriadorPrestadorInput = Omit<VistoriadorPrestador, 'id' | 'created_at' | 'updated_at' | 'origem'>;

const QUERY_KEY = ['vistoriadores-prestadores'];

export function useVistoriadoresPrestadores() {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: QUERY_KEY,
    queryFn: async (): Promise<VistoriadorPrestador[]> => {
      // Fonte 1: vistoriadores_prestadores (cadastro dedicado a vistorias)
      const { data: vp, error: vpErr } = await (supabase as any)
        .from('vistoriadores_prestadores')
        .select('*')
        .order('nome');
      if (vpErr) throw vpErr;

      // Fonte 2: prestadores_instalacao (cadastro usado em /monitoramento/prestadores-parceiros)
      const { data: pi, error: piErr } = await (supabase as any)
        .from('prestadores_instalacao')
        .select('id, nome, whatsapp, ativo, created_at, updated_at')
        .order('nome');
      if (piErr) console.error('[useVistoriadoresPrestadores] prestadores_instalacao:', piErr);

      const fromVp: VistoriadorPrestador[] = (vp ?? []).map((p: any) => ({
        ...p,
        origem: 'vistoriador_prestador' as const,
      }));

      const idsVp = new Set(fromVp.map(p => p.id));
      const fromPi: VistoriadorPrestador[] = (pi ?? [])
        .filter((p: any) => !idsVp.has(p.id)) // evita duplicados se houver mesmo id
        .map((p: any) => ({
          id: p.id,
          nome: p.nome,
          telefone: p.whatsapp ?? null,
          email: null,
          cpf_cnpj: null,
          ativo: !!p.ativo,
          observacoes: null,
          created_at: p.created_at,
          updated_at: p.updated_at,
          origem: 'prestador_instalacao' as const,
        }));

      return [...fromVp, ...fromPi].sort((a, b) => a.nome.localeCompare(b.nome));
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
