import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export function useAdvogados(filters?: { ativo?: boolean; tipo?: string }) {
  const queryClient = useQueryClient();

  const { data: advogados = [], isLoading } = useQuery({
    queryKey: ['advogados', filters],
    queryFn: async () => {
      let query = supabase
        .from('advogados')
        .select('*')
        .order('nome');

      if (filters?.ativo !== undefined) {
        query = query.eq('ativo', filters.ativo);
      }
      if (filters?.tipo) {
        query = query.eq('tipo', filters.tipo);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  const { mutateAsync: criarAdvogado, isPending: isCriando } = useMutation({
    mutationFn: async (advogado: {
      tipo: string;
      nome: string;
      cpf_cnpj?: string;
      oab?: string;
      oab_estado?: string;
      email?: string;
      telefone?: string;
      whatsapp?: string;
      especialidades?: string[];
      tipo_contrato?: string;
      valor_fixo?: number;
      percentual_exito?: number;
      cep?: string;
      logradouro?: string;
      numero?: string;
      complemento?: string;
      bairro?: string;
      cidade?: string;
      estado?: string;
      banco?: string;
      agencia?: string;
      conta?: string;
      pix_chave?: string;
      pix_tipo?: string;
      ativo?: boolean;
    }) => {
      const { data, error } = await supabase
        .from('advogados')
        .insert([advogado])
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['advogados'] });
      toast.success('Advogado cadastrado com sucesso!');
    },
    onError: (error) => {
      toast.error('Erro ao cadastrar advogado: ' + error.message);
    },
  });

  const { mutateAsync: atualizarAdvogado, isPending: isAtualizando } = useMutation({
    mutationFn: async ({ id, ...data }: { id: string; [key: string]: unknown }) => {
      const { error } = await supabase
        .from('advogados')
        .update({ ...data, updated_at: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['advogados'] });
      toast.success('Advogado atualizado com sucesso!');
    },
    onError: (error) => {
      toast.error('Erro ao atualizar advogado: ' + error.message);
    },
  });

  return {
    advogados,
    isLoading,
    criarAdvogado,
    atualizarAdvogado,
    isCriando,
    isAtualizando,
  };
}

export function useAdvogado(id?: string) {
  return useQuery({
    queryKey: ['advogados', id],
    queryFn: async () => {
      if (!id) return null;
      const { data, error } = await supabase
        .from('advogados')
        .select('*')
        .eq('id', id)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });
}
