import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Tables, TablesInsert, TablesUpdate, Database } from '@/integrations/supabase/types';
import { startOfWeek, endOfWeek, format, addDays } from 'date-fns';

export type Rota = Tables<'rotas'>;
export type RotaInsert = TablesInsert<'rotas'>;
export type RotaUpdate = TablesUpdate<'rotas'>;
export type StatusRota = Database['public']['Enums']['status_rota'];

export interface RotaWithRelations extends Rota {
  instalador?: Tables<'profiles'> | null;
  coordenador?: Tables<'profiles'> | null;
  instalacoes?: (Tables<'instalacoes'> & {
    associados?: Tables<'associados'> | null;
    veiculos?: Tables<'veiculos'> | null;
  })[];
}

export interface RotaFilters {
  dataInicio?: Date;
  dataFim?: Date;
  status?: StatusRota[];
  instaladorId?: string;
  cidade?: string;
  search?: string;
}

export const STATUS_ROTA_LABELS: Record<StatusRota, string> = {
  pendente: 'Pendente',
  em_andamento: 'Em Andamento',
  concluida: 'Concluída',
  cancelada: 'Cancelada',
};

export const STATUS_ROTA_COLORS: Record<StatusRota, string> = {
  pendente: 'bg-muted text-muted-foreground',
  em_andamento: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300',
  concluida: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',
  cancelada: 'bg-destructive/10 text-destructive',
};

// Lista de rotas com filtros
export function useRotas(filters?: RotaFilters) {
  return useQuery({
    queryKey: ['rotas', filters],
    queryFn: async () => {
      let query = supabase
        .from('rotas')
        .select(`
          *,
          instalador:profiles!rotas_instalador_id_fkey(*),
          coordenador:profiles!rotas_coordenador_id_fkey(*)
        `)
        .order('data_rota', { ascending: false });

      if (filters?.dataInicio) {
        query = query.gte('data_rota', format(filters.dataInicio, 'yyyy-MM-dd'));
      }
      if (filters?.dataFim) {
        query = query.lte('data_rota', format(filters.dataFim, 'yyyy-MM-dd'));
      }
      if (filters?.status?.length) {
        query = query.in('status', filters.status);
      }
      if (filters?.instaladorId) {
        query = query.eq('instalador_id', filters.instaladorId);
      }
      if (filters?.cidade) {
        query = query.eq('cidade', filters.cidade);
      }
      if (filters?.search) {
        query = query.ilike('codigo', `%${filters.search}%`);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as RotaWithRelations[];
    },
  });
}

// Rota única com instalações
export function useRota(id: string | undefined) {
  return useQuery({
    queryKey: ['rota', id],
    queryFn: async () => {
      if (!id) return null;

      const { data: rota, error: rotaError } = await supabase
        .from('rotas')
        .select(`
          *,
          instalador:profiles!rotas_instalador_id_fkey(*),
          coordenador:profiles!rotas_coordenador_id_fkey(*)
        `)
        .eq('id', id)
        .maybeSingle();

      if (rotaError) throw rotaError;
      if (!rota) return null;

      const { data: instalacoes, error: instError } = await supabase
        .from('instalacoes')
        .select(`
          *,
          associados(*),
          veiculos(*)
        `)
        .eq('rota_id', id)
        .order('periodo');

      if (instError) throw instError;

      return { ...rota, instalacoes } as RotaWithRelations;
    },
    enabled: !!id,
  });
}

// Métricas para dashboard
export function useRotasMetricas() {
  return useQuery({
    queryKey: ['rotas-metricas'],
    queryFn: async () => {
      const hoje = format(new Date(), 'yyyy-MM-dd');
      const inicioSemana = format(startOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-MM-dd');
      const fimSemana = format(endOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-MM-dd');

      // Rotas hoje
      const { count: rotasHoje } = await supabase
        .from('rotas')
        .select('*', { count: 'exact', head: true })
        .eq('data_rota', hoje);

      // Em andamento
      const { count: emAndamento } = await supabase
        .from('rotas')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'em_andamento');

      // Instaladores ativos (com rotas hoje)
      const { data: instaladoresData } = await supabase
        .from('rotas')
        .select('instalador_id')
        .eq('data_rota', hoje)
        .not('instalador_id', 'is', null);

      const instaladoresAtivos = new Set(instaladoresData?.map(r => r.instalador_id)).size;

      // Concluídas na semana
      const { count: concluidasSemana } = await supabase
        .from('rotas')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'concluida')
        .gte('data_rota', inicioSemana)
        .lte('data_rota', fimSemana);

      return {
        rotasHoje: rotasHoje || 0,
        emAndamento: emAndamento || 0,
        instaladoresAtivos,
        concluidasSemana: concluidasSemana || 0,
      };
    },
  });
}

// Rotas da semana para calendário
export function useRotasSemana(dataInicio: Date) {
  const inicio = startOfWeek(dataInicio, { weekStartsOn: 1 });
  const fim = endOfWeek(dataInicio, { weekStartsOn: 1 });

  return useQuery({
    queryKey: ['rotas-semana', format(inicio, 'yyyy-MM-dd')],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('rotas')
        .select(`
          *,
          instalador:profiles!rotas_instalador_id_fkey(id, nome)
        `)
        .gte('data_rota', format(inicio, 'yyyy-MM-dd'))
        .lte('data_rota', format(fim, 'yyyy-MM-dd'))
        .order('data_rota');

      if (error) throw error;

      // Agrupar por dia
      const rotasPorDia: Record<string, RotaWithRelations[]> = {};
      for (let i = 0; i < 7; i++) {
        const dia = format(addDays(inicio, i), 'yyyy-MM-dd');
        rotasPorDia[dia] = [];
      }

      data?.forEach(rota => {
        if (rotasPorDia[rota.data_rota]) {
          rotasPorDia[rota.data_rota].push(rota as RotaWithRelations);
        }
      });

      return rotasPorDia;
    },
  });
}

// Instalações sem rota para uma data
export function useInstalacoesDisponiveis(data?: Date) {
  return useQuery({
    queryKey: ['instalacoes-disponiveis', data ? format(data, 'yyyy-MM-dd') : 'todas'],
    queryFn: async () => {
      let query = supabase
        .from('instalacoes')
        .select(`
          *,
          associados(id, nome, telefone),
          veiculos(id, marca, modelo, placa, ano_modelo)
        `)
        .is('rota_id', null)
        .in('status', ['agendada', 'reagendada'])
        .order('data_agendada');

      if (data) {
        query = query.eq('data_agendada', format(data, 'yyyy-MM-dd'));
      }

      const { data: instalacoes, error } = await query;
      if (error) throw error;
      return instalacoes;
    },
  });
}

// Instaladores disponíveis
export function useInstaladores() {
  return useQuery({
    queryKey: ['instaladores'],
    queryFn: async () => {
      const { data: roles, error: rolesError } = await supabase
        .from('user_roles')
        .select('user_id')
        .eq('role', 'instalador_vistoriador');

      if (rolesError) throw rolesError;
      if (!roles?.length) return [];

      const userIds = roles.map(r => r.user_id);

      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('*')
        .in('user_id', userIds)
        .eq('ativo', true)
        .order('nome');

      if (profilesError) throw profilesError;
      return profiles || [];
    },
  });
}

// Cidades com instalações
export function useCidadesComInstalacoes() {
  return useQuery({
    queryKey: ['cidades-instalacoes'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('instalacoes')
        .select('cidade')
        .not('cidade', 'is', null)
        .order('cidade');

      if (error) throw error;

      const cidades = [...new Set(data?.map(i => i.cidade).filter(Boolean))];
      return cidades as string[];
    },
  });
}

// Criar rota
export function useCreateRota() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (rota: Omit<RotaInsert, 'codigo'>) => {
      // Gerar código temporário - será sobrescrito pelo trigger
      const codigo = `ROT-${format(new Date(rota.data_rota), 'yyyyMMdd')}-TMP`;
      const { data, error } = await supabase
        .from('rotas')
        .insert([{ ...rota, codigo }])
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rotas'] });
      queryClient.invalidateQueries({ queryKey: ['rotas-metricas'] });
      queryClient.invalidateQueries({ queryKey: ['rotas-semana'] });
    },
  });
}

// Atualizar rota
export function useUpdateRota() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...rota }: RotaUpdate & { id: string }) => {
      const { data, error } = await supabase
        .from('rotas')
        .update(rota)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['rotas'] });
      queryClient.invalidateQueries({ queryKey: ['rota', variables.id] });
      queryClient.invalidateQueries({ queryKey: ['rotas-metricas'] });
      queryClient.invalidateQueries({ queryKey: ['rotas-semana'] });
    },
  });
}

// Atualizar status da rota
export function useUpdateRotaStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: StatusRota }) => {
      const { data, error } = await supabase
        .from('rotas')
        .update({ status })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['rotas'] });
      queryClient.invalidateQueries({ queryKey: ['rota', variables.id] });
      queryClient.invalidateQueries({ queryKey: ['rotas-metricas'] });
      queryClient.invalidateQueries({ queryKey: ['rotas-semana'] });
    },
  });
}

// Deletar rota
export function useDeleteRota() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      // Primeiro desvincula instalações
      await supabase
        .from('instalacoes')
        .update({ rota_id: null })
        .eq('rota_id', id);

      const { error } = await supabase
        .from('rotas')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rotas'] });
      queryClient.invalidateQueries({ queryKey: ['rotas-metricas'] });
      queryClient.invalidateQueries({ queryKey: ['rotas-semana'] });
      queryClient.invalidateQueries({ queryKey: ['instalacoes-disponiveis'] });
    },
  });
}

// Adicionar instalação à rota
export function useAddInstalacaoToRota() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ instalacaoId, rotaId }: { instalacaoId: string; rotaId: string }) => {
      const { error } = await supabase
        .from('instalacoes')
        .update({ rota_id: rotaId })
        .eq('id', instalacaoId);

      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['rota', variables.rotaId] });
      queryClient.invalidateQueries({ queryKey: ['rotas'] });
      queryClient.invalidateQueries({ queryKey: ['instalacoes-disponiveis'] });
    },
  });
}

// Remover instalação da rota
export function useRemoveInstalacaoFromRota() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ instalacaoId, rotaId }: { instalacaoId: string; rotaId: string }) => {
      const { error } = await supabase
        .from('instalacoes')
        .update({ rota_id: null })
        .eq('id', instalacaoId);

      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['rota', variables.rotaId] });
      queryClient.invalidateQueries({ queryKey: ['rotas'] });
      queryClient.invalidateQueries({ queryKey: ['instalacoes-disponiveis'] });
    },
  });
}

// Rotas do dia (wrapper para useRotas com filtro de data)
export function useRotasDoDia(data?: string) {
  const dataFiltro = data || format(new Date(), 'yyyy-MM-dd');
  return useRotas({
    dataInicio: new Date(dataFiltro),
    dataFim: new Date(dataFiltro),
  });
}

// Profissionais sem rota para uma data específica
export function useProfissionaisSemRota(data: Date) {
  return useQuery({
    queryKey: ['profissionais-sem-rota', format(data, 'yyyy-MM-dd')],
    queryFn: async () => {
      const dataStr = format(data, 'yyyy-MM-dd');
      
      // Buscar profissionais com função de instalador/vistoriador
      const { data: roles, error: rolesError } = await supabase
        .from('user_roles')
        .select('user_id')
        .eq('role', 'instalador_vistoriador');
      
      if (rolesError) throw rolesError;
      
      const userIds = roles?.map(r => r.user_id) || [];
      if (!userIds.length) return [];
      
      // Buscar profiles ativos
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('*')
        .in('user_id', userIds)
        .eq('ativo', true)
        .order('nome');
      
      if (profilesError) throw profilesError;
      
      // Buscar rotas do dia para filtrar quem já tem
      const { data: rotasDia, error: rotasError } = await supabase
        .from('rotas')
        .select('instalador_id')
        .eq('data_rota', dataStr);
      
      if (rotasError) throw rotasError;
      
      const idsComRota = new Set(rotasDia?.map(r => r.instalador_id) || []);
      
      // Retornar apenas quem NÃO tem rota
      return (profiles || []).filter(p => !idsComRota.has(p.id));
    },
  });
}
