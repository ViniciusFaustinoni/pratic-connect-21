import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { format } from 'date-fns';
import type { Tables } from '@/integrations/supabase/types';

export type Instalacao = Tables<'instalacoes'>;

export interface InstalacaoComRelacoes extends Instalacao {
  associados: {
    nome: string;
    telefone: string;
    email: string;
    whatsapp: string | null;
  } | null;
  veiculos: {
    marca: string;
    modelo: string;
    placa: string;
    ano_modelo: number;
    cor: string | null;
  } | null;
  rastreadores: {
    codigo: string;
    numero_serie: string | null;
  } | null;
}

export function useInstaladorInstalacoes(data?: Date) {
  const { profile } = useAuth();
  const dataFormatada = data ? format(data, 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd');

  return useQuery({
    queryKey: ['instalador-instalacoes', profile?.id, dataFormatada],
    queryFn: async () => {
      const { data: instalacoes, error } = await supabase
        .from('instalacoes')
        .select(`
          *,
          associados (nome, telefone, email, whatsapp),
          veiculos (marca, modelo, placa, ano_modelo, cor),
          rastreadores (codigo, numero_serie)
        `)
        .eq('instalador_id', profile?.id)
        .eq('data_agendada', dataFormatada)
        .in('status', ['agendada', 'em_rota', 'em_andamento'])
        .order('periodo', { ascending: true });

      if (error) throw error;
      return instalacoes as InstalacaoComRelacoes[];
    },
    enabled: !!profile?.id,
  });
}

export function useInstalacaoDetalhes(id: string | undefined) {
  return useQuery({
    queryKey: ['instalacao-detalhes', id],
    queryFn: async () => {
      if (!id) throw new Error('ID não fornecido');

      const { data, error } = await supabase
        .from('instalacoes')
        .select(`
          *,
          associados (id, nome, telefone, email, whatsapp, cpf),
          veiculos (id, marca, modelo, placa, ano_modelo, cor, chassi),
          rastreadores (id, codigo, numero_serie, imei)
        `)
        .eq('id', id)
        .single();

      if (error) throw error;
      return data as InstalacaoComRelacoes;
    },
    enabled: !!id,
  });
}

export function useIniciarInstalacao() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('instalacoes')
        .update({ status: 'em_andamento' })
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['instalador-instalacoes'] });
      queryClient.invalidateQueries({ queryKey: ['instalacao-detalhes'] });
    },
  });
}

export function useConcluirInstalacao() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('instalacoes')
        .update({ status: 'concluida' })
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['instalador-instalacoes'] });
      queryClient.invalidateQueries({ queryKey: ['instalacao-detalhes'] });
    },
  });
}
