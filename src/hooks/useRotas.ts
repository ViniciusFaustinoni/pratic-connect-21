import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Tables, TablesInsert, TablesUpdate, Database } from '@/integrations/supabase/types';
import { startOfWeek, endOfWeek, format, addDays } from 'date-fns';

export type Rota = Tables<'rotas'>;
export type RotaInsert = TablesInsert<'rotas'>;
export type RotaUpdate = TablesUpdate<'rotas'>;
export type StatusRota = Database['public']['Enums']['status_rota'];

export interface RotaInstalador {
  id: string;
  instalador_id: string;
  instalador?: Tables<'profiles'> | null;
}

export interface RotaWithRelations extends Rota {
  instalador?: Tables<'profiles'> | null;
  coordenador?: Tables<'profiles'> | null;
  rota_instaladores?: RotaInstalador[];
  instalacoes?: (Tables<'instalacoes'> & {
    associados?: Tables<'associados'> | null;
    veiculos?: Tables<'veiculos'> | null;
    instalador_responsavel?: Tables<'profiles'> | null;
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

// Rota única com instalações, vistorias e múltiplos instaladores
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

      // Buscar instaladores da rota (tabela N:N)
      const { data: rotaInstaladores, error: riError } = await supabase
        .from('rota_instaladores')
        .select(`
          id,
          instalador_id,
          instalador:profiles(*)
        `)
        .eq('rota_id', id);

      if (riError) console.error('Error fetching rota_instaladores:', riError);

      // Fase 3: leitura unificada de `servicos` (substitui instalacoes + vistorias)
      const { data: servicos, error: servError } = await supabase
        .from('servicos')
        .select(`
          *,
          associados(*),
          veiculos:veiculos!servicos_veiculo_id_fkey(*),
          profissional:profiles!servicos_profissional_id_fkey(id, nome, telefone)
        `)
        .eq('rota_id', id)
        .order('periodo');

      if (servError) throw servError;

      // Particiona por tipo, mantendo o shape esperado pelos consumers
      const instalacoes = (servicos || [])
        .filter((s: any) => s.tipo === 'vistoria_instalacao')
        .map((s: any) => ({
          ...s,
          instalador_responsavel_id: s.profissional_id,
          instalador_responsavel: s.profissional,
        }));

      const vistorias = (servicos || [])
        .filter((s: any) => s.tipo !== 'vistoria_instalacao')
        .map((s: any) => ({
          ...s,
          vistoriador_id: s.profissional_id,
          vistoriador: s.profissional,
          endereco_bairro: s.bairro,
          endereco_cidade: s.cidade,
          endereco_logradouro: s.logradouro,
          endereco_numero: s.numero,
          endereco_cep: s.cep,
        }));

      return {
        ...rota,
        instalacoes,
        vistorias,
        rota_instaladores: rotaInstaladores || []
      } as RotaWithRelations & { vistorias: any[] };
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
      // Fase 3: lê de `servicos` filtrando por tipo='vistoria_instalacao'
      let query = supabase
        .from('servicos')
        .select(`
          *,
          associados(id, nome, telefone),
          veiculos:veiculos!servicos_veiculo_id_fkey(id, marca, modelo, placa, ano_modelo)
        `)
        .eq('tipo', 'vistoria_instalacao' as any)
        .is('rota_id', null)
        .in('status', ['agendada', 'reagendada'])
        .order('data_agendada');

      if (data) {
        query = query.eq('data_agendada', format(data, 'yyyy-MM-dd'));
      }

      const { data: servicos, error } = await query;
      if (error) throw error;
      return servicos;
    },
  });
}

// Instaladores disponíveis
export function useInstaladores() {
  return useQuery({
    queryKey: ['instaladores'],
    queryFn: async () => {
      // Buscar roles operacionais (instaladores/vistoriadores) dinamicamente
      const { data: configs } = await supabase
        .from('app_roles_config')
        .select('role')
        .eq('is_operational', true)
        .eq('is_active', true);
      
      const operationalRoles = (configs || [])
        .map((c: any) => c.role)
        .filter((r: string) => r.includes('instalador') || r.includes('vistoriador'));
      if (operationalRoles.length === 0) operationalRoles.push('instalador_vistoriador');

      const { data: roles, error: rolesError } = await supabase
        .from('user_roles')
        .select('user_id')
        .in('role', operationalRoles);

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
      // Fase 3: lê de `servicos` (todas tipos) — cidades operacionais
      const { data, error } = await supabase
        .from('servicos')
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
      // Fase 3: desvincular serviços (instalações + vistorias unificadas)
      await supabase
        .from('servicos')
        .update({ rota_id: null } as any)
        .eq('rota_id', id);

      // Excluir vínculos N:N com instaladores
      await supabase
        .from('rota_instaladores')
        .delete()
        .eq('rota_id', id);

      // Excluir a rota
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
      queryClient.invalidateQueries({ queryKey: ['servicos'] });
      queryClient.invalidateQueries({ queryKey: ['equipe'] });
    },
  });
}

// Adicionar instalação à rota
export function useAddInstalacaoToRota() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ instalacaoId, rotaId, instaladorId }: { instalacaoId: string; rotaId: string; instaladorId?: string }) => {
      // Fase 3: opera diretamente em servicos
      const { data: servico, error: fetchError } = await supabase
        .from('servicos')
        .select('id, profissional_id')
        .eq('id', instalacaoId)
        .single();

      if (fetchError) throw fetchError;

      const responsavelId = instaladorId || servico?.profissional_id;

      const update: Record<string, unknown> = { rota_id: rotaId };
      if (responsavelId) update.profissional_id = responsavelId;

      const { error } = await supabase
        .from('servicos')
        .update(update as any)
        .eq('id', instalacaoId);

      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['rota', variables.rotaId] });
      queryClient.invalidateQueries({ queryKey: ['rotas'] });
      queryClient.invalidateQueries({ queryKey: ['instalacoes-disponiveis'] });
      queryClient.invalidateQueries({ queryKey: ['vistorias-mapa'] });
      queryClient.invalidateQueries({ queryKey: ['servicos-por-bairros'] });
      queryClient.invalidateQueries({ queryKey: ['servicos'] });
      queryClient.invalidateQueries({ queryKey: ['equipe'] });
    },
  });
}

// Remover instalação da rota
export function useRemoveInstalacaoFromRota() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ instalacaoId, rotaId }: { instalacaoId: string; rotaId: string }) => {
      // Fase 3: opera diretamente em servicos
      const { error } = await supabase
        .from('servicos')
        .update({ rota_id: null } as any)
        .eq('id', instalacaoId)
        .eq('rota_id', rotaId);

      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['rota', variables.rotaId] });
      queryClient.invalidateQueries({ queryKey: ['rotas'] });
      queryClient.invalidateQueries({ queryKey: ['instalacoes-disponiveis'] });
      queryClient.invalidateQueries({ queryKey: ['vistorias-mapa'] });
      queryClient.invalidateQueries({ queryKey: ['servicos-por-bairros'] });
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
      // Buscar roles operacionais (instaladores/vistoriadores) dinamicamente
      const { data: configsOp } = await supabase
        .from('app_roles_config')
        .select('role')
        .eq('is_operational', true)
        .eq('is_active', true);
      
      const opRoles = (configsOp || [])
        .map((c: any) => c.role)
        .filter((r: string) => r.includes('instalador') || r.includes('vistoriador'));
      if (opRoles.length === 0) opRoles.push('instalador_vistoriador');

      const { data: roles, error: rolesError } = await supabase
        .from('user_roles')
        .select('user_id')
        .in('role', opRoles);
      
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
