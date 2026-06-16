import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

const sb = supabase as any;

export const EMPRESA_PAPEIS = [
  { value: 'associacao', label: 'Associação' },
  { value: 'oficina', label: 'Oficina' },
  { value: 'gestao', label: 'Gestão' },
  { value: 'marketing_vendas', label: 'Marketing / Vendas' },
  { value: 'monitoramento', label: 'Monitoramento' },
  { value: 'assistencia', label: 'Assistência 24h' },
  { value: 'outros', label: 'Outros' },
] as const;

export interface Empresa {
  id: string;
  nome: string;
  tipo: 'associacao' | 'ltda';
  papel: string;
  cnpj: string | null;
  percentual_rateio: number;
  cor: string;
  ativo: boolean;
  ordem: number;
}

export interface SetorEmpresa {
  setor: string;
  empresa_id: string | null;
}

export function useEmpresas() {
  return useQuery({
    queryKey: ['empresas'],
    queryFn: async (): Promise<Empresa[]> => {
      const { data, error } = await sb.from('empresas').select('*').order('ordem');
      if (error) throw error;
      return (data ?? []) as Empresa[];
    },
  });
}

export function useSetorEmpresaMap() {
  return useQuery({
    queryKey: ['setor-empresa-map'],
    queryFn: async (): Promise<SetorEmpresa[]> => {
      const { data, error } = await sb.from('setor_empresa_map').select('setor, empresa_id');
      if (error) throw error;
      return (data ?? []) as SetorEmpresa[];
    },
  });
}

export function useSalvarEmpresa() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (e: Partial<Empresa> & { id?: string }) => {
      const payload = {
        nome: e.nome,
        tipo: e.tipo,
        papel: e.papel,
        cnpj: e.cnpj || null,
        percentual_rateio: e.percentual_rateio ?? 0,
        ativo: e.ativo ?? true,
        ordem: e.ordem ?? 100,
        updated_at: new Date().toISOString(),
      };
      if (e.id) {
        const { error } = await sb.from('empresas').update(payload).eq('id', e.id);
        if (error) throw error;
      } else {
        const { error } = await sb.from('empresas').insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success('Empresa salva!');
      qc.invalidateQueries({ queryKey: ['empresas'] });
    },
    onError: () => toast.error('Erro ao salvar empresa'),
  });
}

export function useSalvarVinculoSetor() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: { setor: string; empresa_id: string | null }) => {
      const { error } = await sb
        .from('setor_empresa_map')
        .upsert(
          { setor: params.setor, empresa_id: params.empresa_id, updated_at: new Date().toISOString() },
          { onConflict: 'setor' },
        );
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Vínculo atualizado!');
      qc.invalidateQueries({ queryKey: ['setor-empresa-map'] });
    },
    onError: () => toast.error('Erro ao atualizar vínculo'),
  });
}
