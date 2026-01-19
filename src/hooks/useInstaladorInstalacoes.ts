import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { format, startOfWeek, startOfMonth } from 'date-fns';
import type { Tables } from '@/integrations/supabase/types';

// Tipos para estatísticas do instalador
interface EstatisticasInstalador {
  hoje: number;
  semana: number;
  mes: number;
  pendentes: number;
}

export type Instalacao = Tables<'instalacoes'>;

export interface InstalacaoComRelacoes extends Instalacao {
  associados: {
    id: string;
    nome: string;
    telefone: string;
    email: string;
    whatsapp: string | null;
  } | null;
  veiculos: {
    id: string;
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

// Hook para estatísticas do instalador
export function useEstatisticasInstalador() {
  const { profile } = useAuth();
  
  return useQuery({
    queryKey: ['instalador-estatisticas', profile?.id],
    queryFn: async (): Promise<EstatisticasInstalador> => {
      if (!profile?.id) return { hoje: 0, semana: 0, mes: 0, pendentes: 0 };
      
      const hoje = format(new Date(), 'yyyy-MM-dd');
      const inicioSemana = format(startOfWeek(new Date(), { weekStartsOn: 0 }), 'yyyy-MM-dd');
      const inicioMes = format(startOfMonth(new Date()), 'yyyy-MM-dd');

      const [hojeConcluidas, semanaConcluidas, mesConcluidas, pendentes] = await Promise.all([
        supabase.from('instalacoes').select('*', { count: 'exact', head: true })
          .eq('instalador_id', profile.id).eq('data_agendada', hoje).eq('status', 'concluida'),
        supabase.from('instalacoes').select('*', { count: 'exact', head: true })
          .eq('instalador_id', profile.id).gte('data_agendada', inicioSemana).eq('status', 'concluida'),
        supabase.from('instalacoes').select('*', { count: 'exact', head: true })
          .eq('instalador_id', profile.id).gte('data_agendada', inicioMes).eq('status', 'concluida'),
        supabase.from('instalacoes').select('*', { count: 'exact', head: true })
          .eq('instalador_id', profile.id).in('status', ['agendada', 'em_andamento', 'em_rota']),
      ]);

      return {
        hoje: hojeConcluidas.count || 0,
        semana: semanaConcluidas.count || 0,
        mes: mesConcluidas.count || 0,
        pendentes: pendentes.count || 0,
      };
    },
    enabled: !!profile?.id,
    staleTime: 5 * 60 * 1000, // Cache por 5 minutos
  });
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
          associados (id, nome, telefone, email, whatsapp),
          veiculos (id, marca, modelo, placa, ano_modelo, cor),
          rastreadores (codigo, numero_serie)
        `)
        .eq('instalador_id', profile?.id)
        .eq('data_agendada', dataFormatada)
        .in('status', ['agendada', 'em_rota', 'em_andamento', 'concluida'])
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
        .update({ 
          status: 'concluida',
          concluida_em: new Date().toISOString()
        })
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['instalador-instalacoes'] });
      queryClient.invalidateQueries({ queryKey: ['instalacao-detalhes'] });
      queryClient.invalidateQueries({ queryKey: ['instalacoes'] });
    },
  });
}

// Hook para aprovar veículo e ativar cobertura total
export function useAprovarVeiculo() {
  const queryClient = useQueryClient();
  const { profile } = useAuth();

  return useMutation({
    mutationFn: async ({ 
      instalacaoId, 
      veiculoId,
      associadoId 
    }: { 
      instalacaoId: string;
      veiculoId: string;
      associadoId: string;
    }) => {
      // 1. Atualizar veículo com cobertura total
      const { error: veiculoError } = await supabase
        .from('veiculos')
        .update({ 
          status: 'ativo',
          cobertura_total: true,
          updated_at: new Date().toISOString(),
        })
        .eq('id', veiculoId);

      if (veiculoError) throw veiculoError;

      // 2. Atualizar associado para ativo
      const { error: associadoError } = await supabase
        .from('associados')
        .update({ 
          status: 'ativo',
          data_ativacao: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', associadoId);

      if (associadoError) throw associadoError;

      // 3. Concluir instalação
      const { error: instalacaoError } = await supabase
        .from('instalacoes')
        .update({ 
          status: 'concluida',
          concluida_em: new Date().toISOString(),
        })
        .eq('id', instalacaoId);

      if (instalacaoError) throw instalacaoError;

      // 4. Registrar no histórico
      await supabase.from('associados_historico').insert({
        associado_id: associadoId,
        tipo: 'veiculo_aprovado',
        descricao: 'Veículo aprovado pelo técnico instalador - Cobertura total ativada',
        dados_novos: { 
          instalacao_id: instalacaoId, 
          veiculo_id: veiculoId,
          cobertura_total: true,
        },
        usuario_id: profile?.id,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['instalador-instalacoes'] });
      queryClient.invalidateQueries({ queryKey: ['instalacao-detalhes'] });
      queryClient.invalidateQueries({ queryKey: ['instalacoes'] });
      queryClient.invalidateQueries({ queryKey: ['veiculos'] });
      queryClient.invalidateQueries({ queryKey: ['associados'] });
    },
  });
}

// Hook para recusar veículo
export function useRecusarVeiculo() {
  const queryClient = useQueryClient();
  const { profile } = useAuth();

  return useMutation({
    mutationFn: async ({ 
      instalacaoId, 
      veiculoId,
      associadoId,
      motivo 
    }: { 
      instalacaoId: string;
      veiculoId: string;
      associadoId: string;
      motivo: string;
    }) => {
      // 1. Atualizar veículo como suspenso (recusado na instalação)
      const { error: veiculoError } = await supabase
        .from('veiculos')
        .update({ 
          status: 'suspenso',
          motivo_recusa_veiculo: motivo,
          recusado_por: profile?.id,
          recusado_em: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', veiculoId);

      if (veiculoError) throw veiculoError;

      // 2. Cancelar instalação
      const { error: instalacaoError } = await supabase
        .from('instalacoes')
        .update({ 
          status: 'cancelada',
          observacoes: `Veículo recusado: ${motivo}`,
        })
        .eq('id', instalacaoId);

      if (instalacaoError) throw instalacaoError;

      // 3. Registrar no histórico
      await supabase.from('associados_historico').insert({
        associado_id: associadoId,
        tipo: 'veiculo_recusado',
        descricao: `Veículo recusado pelo técnico instalador: ${motivo}`,
        dados_novos: { 
          instalacao_id: instalacaoId, 
          veiculo_id: veiculoId,
          motivo,
        },
        usuario_id: profile?.id,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['instalador-instalacoes'] });
      queryClient.invalidateQueries({ queryKey: ['instalacao-detalhes'] });
      queryClient.invalidateQueries({ queryKey: ['instalacoes'] });
      queryClient.invalidateQueries({ queryKey: ['veiculos'] });
    },
  });
}

// Hook para salvar checklist e quilometragem durante a instalação
export function useSalvarChecklistInstalacao() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ 
      id, 
      checklist_data, 
      quilometragem 
    }: { 
      id: string; 
      checklist_data: Record<string, any>;
      quilometragem?: number;
    }) => {
      const updateData: Record<string, any> = {
        checklist_data,
      };
      
      if (quilometragem !== undefined) {
        updateData.quilometragem = quilometragem;
      }

      const { error } = await supabase
        .from('instalacoes')
        .update(updateData)
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['instalacao-detalhes'] });
    },
  });
}

// Hook para iniciar instalação com timestamp
export function useIniciarInstalacaoComTimestamp() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('instalacoes')
        .update({ 
          status: 'em_andamento',
          iniciada_em: new Date().toISOString()
        })
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['instalador-instalacoes'] });
      queryClient.invalidateQueries({ queryKey: ['instalacao-detalhes'] });
    },
  });
}
