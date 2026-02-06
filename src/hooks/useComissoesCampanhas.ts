import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { Campanha } from '@/types/comissoes';

interface CriarCampanhaInput {
  nome: string;
  mes: number;
  ano: number;
  data_inicio: string;
  data_fim: string;
}

export function useComissoesCampanhas() {
  const queryClient = useQueryClient();

  // Query: Todas as campanhas
  const campanhasQuery = useQuery({
    queryKey: ['comissoes-campanhas'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('comissoes_campanhas')
        .select('*')
        .order('ano', { ascending: false })
        .order('mes', { ascending: false });

      if (error) throw error;
      return data as Campanha[];
    },
  });

  // Derivada: Campanha atual (status = 'aberta' mais recente)
  const campanhaAtual = campanhasQuery.data?.find(c => c.status === 'aberta') ?? null;

  // Mutation: Criar campanha
  const criarCampanha = useMutation({
    mutationFn: async (input: CriarCampanhaInput) => {
      const { data, error } = await supabase
        .from('comissoes_campanhas')
        .insert([{
          nome: input.nome,
          mes: input.mes,
          ano: input.ano,
          data_inicio: input.data_inicio,
          data_fim: input.data_fim,
          status: 'aberta',
        }])
        .select()
        .single();

      if (error) throw error;
      return data as Campanha;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['comissoes-campanhas'] });
      toast.success('Campanha criada com sucesso');
    },
    onError: (error: Error) => {
      if (error.message.includes('duplicate key')) {
        toast.error('Já existe uma campanha para este mês/ano');
      } else {
        toast.error('Erro ao criar campanha: ' + error.message);
      }
    },
  });

  // Mutation: Fechar campanha
  const fecharCampanha = useMutation({
    mutationFn: async (id: string) => {
      // Buscar profile do usuário atual
      const { data: { user } } = await supabase.auth.getUser();
      
      let fechadaPor: string | null = null;
      if (user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('id')
          .eq('user_id', user.id)
          .single();
        fechadaPor = profile?.id ?? null;
      }

      const { data, error } = await supabase
        .from('comissoes_campanhas')
        .update({
          status: 'fechada',
          fechada_por: fechadaPor,
          fechada_em: new Date().toISOString(),
        })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data as Campanha;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['comissoes-campanhas'] });
      toast.success('Campanha fechada com sucesso');
    },
    onError: (error: Error) => {
      toast.error('Erro ao fechar campanha: ' + error.message);
    },
  });

  // Mutation: Atualizar status da campanha
  const atualizarStatusCampanha = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: Campanha['status'] }) => {
      const { data, error } = await supabase
        .from('comissoes_campanhas')
        .update({ status })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data as Campanha;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['comissoes-campanhas'] });
      toast.success('Status atualizado');
    },
    onError: (error: Error) => {
      toast.error('Erro ao atualizar status: ' + error.message);
    },
  });

  return {
    campanhas: campanhasQuery.data ?? [],
    campanhaAtual,
    isLoading: campanhasQuery.isLoading,
    criarCampanha,
    fecharCampanha,
    atualizarStatusCampanha,
  };
}
