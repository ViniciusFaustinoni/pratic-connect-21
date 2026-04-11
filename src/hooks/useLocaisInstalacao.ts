import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface LocalInstalacao {
  id: string;
  value: string;
  label: string;
  tipo_veiculo: string;
  ativo: boolean;
  ordem: number;
}

export function useLocaisInstalacao(tipoVeiculo?: string) {
  return useQuery({
    queryKey: ['locais-instalacao', tipoVeiculo],
    queryFn: async () => {
      let query = supabase
        .from('locais_instalacao')
        .select('*')
        .eq('ativo', true)
        .order('ordem', { ascending: true });

      if (tipoVeiculo && tipoVeiculo !== 'ambos') {
        query = query.in('tipo_veiculo', [tipoVeiculo, 'ambos']);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as LocalInstalacao[];
    },
  });
}

export function useLocaisInstalacaoAdmin() {
  return useQuery({
    queryKey: ['locais-instalacao-admin'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('locais_instalacao')
        .select('*')
        .order('ordem', { ascending: true });
      if (error) throw error;
      return data as LocalInstalacao[];
    },
  });
}

export function useCreateLocalInstalacao() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { label: string; tipo_veiculo: string }) => {
      const value = input.label
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_|_$/g, '');

      const { data, error } = await supabase
        .from('locais_instalacao')
        .insert({ value, label: input.label, tipo_veiculo: input.tipo_veiculo, ordem: 50 })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['locais-instalacao'] });
      toast.success('Local de instalação adicionado');
    },
    onError: (err: any) => {
      if (err?.code === '23505') {
        toast.error('Este local já existe');
      } else if (err?.code === '42501' || err?.message?.includes('row-level security')) {
        toast.error('Sem permissão para adicionar locais de instalação');
      } else {
        toast.error('Erro ao adicionar local');
      }
    },
  });
}

export function useToggleLocalInstalacao() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ativo }: { id: string; ativo: boolean }) => {
      const { error } = await supabase
        .from('locais_instalacao')
        .update({ ativo, updated_at: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['locais-instalacao'] });
      toast.success('Local atualizado');
    },
    onError: (err: any) => {
      if (err?.code === '42501' || err?.message?.includes('row-level security')) {
        toast.error('Sem permissão para atualizar locais de instalação');
      } else {
        toast.error('Erro ao atualizar local');
      }
    },
  });
}
