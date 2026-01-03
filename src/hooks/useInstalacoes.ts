import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Tables, TablesInsert, TablesUpdate, Database } from '@/integrations/supabase/types';
import { startOfDay, endOfDay, addDays } from 'date-fns';

export type Instalacao = Tables<'instalacoes'>;
export type InstalacaoInsert = TablesInsert<'instalacoes'>;
export type InstalacaoUpdate = TablesUpdate<'instalacoes'>;
export type StatusInstalacao = Database['public']['Enums']['status_instalacao'];
export type PeriodoInstalacao = Database['public']['Enums']['periodo_instalacao'];

export interface InstalacaoWithRelations extends Instalacao {
  associados?: Tables<'associados'> | null;
  veiculos?: Tables<'veiculos'> | null;
  rastreadores?: Tables<'rastreadores'> | null;
  profiles?: Tables<'profiles'> | null;
}

export interface InstalacaoFilters {
  status?: StatusInstalacao[];
  periodo?: PeriodoInstalacao;
  dataInicio?: Date;
  dataFim?: Date;
  instaladorId?: string;
  search?: string;
}

export interface InstalacoesMetricas {
  agendadas: number;
  emRota: number;
  concluidasHoje: number;
  reagendadas: number;
}

export function useInstalacoes(filters?: InstalacaoFilters) {
  return useQuery({
    queryKey: ['instalacoes', filters],
    queryFn: async () => {
      let query = supabase
        .from('instalacoes')
        .select(`
          *,
          associados (id, nome, telefone, email),
          veiculos (id, marca, modelo, placa, ano_modelo, cor),
          rastreadores (id, codigo, numero_serie),
          profiles:instalador_id (id, nome, telefone)
        `)
        .order('data_agendada', { ascending: true });

      if (filters?.status && filters.status.length > 0) {
        query = query.in('status', filters.status);
      }

      if (filters?.periodo) {
        query = query.eq('periodo', filters.periodo);
      }

      if (filters?.dataInicio) {
        query = query.gte('data_agendada', filters.dataInicio.toISOString().split('T')[0]);
      }

      if (filters?.dataFim) {
        query = query.lte('data_agendada', filters.dataFim.toISOString().split('T')[0]);
      }

      if (filters?.instaladorId) {
        query = query.eq('instalador_id', filters.instaladorId);
      }

      const { data, error } = await query;

      if (error) throw error;

      // Filter by search on client side (associado name or vehicle plate)
      if (filters?.search) {
        const searchLower = filters.search.toLowerCase();
        return (data as InstalacaoWithRelations[]).filter(inst => 
          inst.associados?.nome?.toLowerCase().includes(searchLower) ||
          inst.veiculos?.placa?.toLowerCase().includes(searchLower)
        );
      }

      return data as InstalacaoWithRelations[];
    },
  });
}

export function useInstalacao(id: string | undefined) {
  return useQuery({
    queryKey: ['instalacao', id],
    queryFn: async () => {
      if (!id) return null;

      const { data, error } = await supabase
        .from('instalacoes')
        .select(`
          *,
          associados (id, nome, telefone, email, cpf, cep, logradouro, numero, complemento, bairro, cidade, uf),
          veiculos (id, marca, modelo, placa, ano_modelo, cor, chassi, renavam),
          rastreadores (id, codigo, numero_serie, imei),
          profiles:instalador_id (id, nome, telefone, email)
        `)
        .eq('id', id)
        .maybeSingle();

      if (error) throw error;
      return data as InstalacaoWithRelations | null;
    },
    enabled: !!id,
  });
}

export function useInstalacoesMetricas() {
  return useQuery({
    queryKey: ['instalacoes-metricas'],
    queryFn: async () => {
      const hoje = new Date();
      const em7Dias = addDays(hoje, 7);

      // Agendadas nos próximos 7 dias
      const { count: agendadas } = await supabase
        .from('instalacoes')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'agendada')
        .gte('data_agendada', hoje.toISOString().split('T')[0])
        .lte('data_agendada', em7Dias.toISOString().split('T')[0]);

      // Em rota
      const { count: emRota } = await supabase
        .from('instalacoes')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'em_rota');

      // Concluídas hoje
      const { count: concluidasHoje } = await supabase
        .from('instalacoes')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'concluida')
        .gte('updated_at', startOfDay(hoje).toISOString())
        .lte('updated_at', endOfDay(hoje).toISOString());

      // Reagendadas
      const { count: reagendadas } = await supabase
        .from('instalacoes')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'reagendada');

      return {
        agendadas: agendadas || 0,
        emRota: emRota || 0,
        concluidasHoje: concluidasHoje || 0,
        reagendadas: reagendadas || 0,
      } as InstalacoesMetricas;
    },
  });
}

export function useCreateInstalacao() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: InstalacaoInsert) => {
      const { data: result, error } = await supabase
        .from('instalacoes')
        .insert(data)
        .select()
        .single();

      if (error) throw error;
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['instalacoes'] });
      queryClient.invalidateQueries({ queryKey: ['instalacoes-metricas'] });
    },
  });
}

export function useUpdateInstalacao() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: InstalacaoUpdate }) => {
      const { data: result, error } = await supabase
        .from('instalacoes')
        .update(data)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return result;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['instalacoes'] });
      queryClient.invalidateQueries({ queryKey: ['instalacao', variables.id] });
      queryClient.invalidateQueries({ queryKey: ['instalacoes-metricas'] });
    },
  });
}

export function useUpdateInstalacaoStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: Instalacao['status'] }) => {
      const { data: result, error } = await supabase
        .from('instalacoes')
        .update({ status })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return result;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['instalacoes'] });
      queryClient.invalidateQueries({ queryKey: ['instalacao', variables.id] });
      queryClient.invalidateQueries({ queryKey: ['instalacoes-metricas'] });
    },
  });
}

export function useDeleteInstalacao() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('instalacoes')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['instalacoes'] });
      queryClient.invalidateQueries({ queryKey: ['instalacoes-metricas'] });
    },
  });
}

// Hook para buscar instaladores (profiles com role instalador_vistoriador)
export function useInstaladores() {
  return useQuery({
    queryKey: ['instaladores'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select(`
          id,
          nome,
          telefone,
          user_roles!inner (role)
        `)
        .eq('user_roles.role', 'instalador_vistoriador')
        .eq('ativo', true);

      if (error) throw error;
      return data;
    },
  });
}

// Hook para buscar rastreadores em estoque
export function useRastreadoresEstoque() {
  return useQuery({
    queryKey: ['rastreadores-estoque'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('rastreadores')
        .select('id, codigo, numero_serie, imei')
        .eq('status', 'estoque');

      if (error) throw error;
      return data;
    },
  });
}
