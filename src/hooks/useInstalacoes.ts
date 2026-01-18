import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Tables, TablesInsert, TablesUpdate } from '@/integrations/supabase/types';
import { startOfDay, endOfDay, addDays } from 'date-fns';
import { toast } from 'sonner';

// ============================================
// TIPOS
// ============================================
export type Instalacao = Tables<'instalacoes'>;
export type InstalacaoInsert = TablesInsert<'instalacoes'>;
export type InstalacaoUpdate = TablesUpdate<'instalacoes'>;

export interface InstalacaoWithRelations extends Instalacao {
  associados?: {
    id: string;
    nome: string;
    telefone: string;
    email: string;
    cpf?: string;
    cep?: string;
    logradouro?: string;
    numero?: string;
    complemento?: string;
    bairro?: string;
    cidade?: string;
    uf?: string;
  } | null;
  veiculos?: {
    id: string;
    placa: string;
    marca: string;
    modelo: string;
    ano_modelo?: number | null;
    cor?: string | null;
    chassi?: string | null;
    renavam?: string | null;
  } | null;
  rastreadores?: {
    id: string;
    codigo: string;
    numero_serie?: string | null;
    imei?: string | null;
    modelo?: string | null;
  } | null;
  profiles?: {
    id: string;
    nome: string;
    telefone?: string | null;
    email?: string | null;
  } | null;
}

export interface InstalacaoFilters {
  status?: Instalacao['status'][] | Instalacao['status'];
  periodo?: Instalacao['periodo'];
  dataInicio?: Date;
  dataFim?: Date;
  data_inicio?: string;
  data_fim?: string;
  instaladorId?: string;
  instalador_id?: string;
  search?: string;
  sem_instalador?: boolean;
}

export interface InstalacoesMetricas {
  agendadas: number;
  emRota: number;
  concluidasHoje: number;
  reagendadas: number;
}

export interface ContagemInstalacoes {
  total: number;
  agendadas: number;
  em_rota: number;
  em_andamento: number;
  concluidas_hoje: number;
  reagendadas: number;
  canceladas: number;
}

// ============================================
// HOOK: LISTA DE INSTALAÇÕES
// ============================================
interface UseInstalacoesParams {
  filters?: InstalacaoFilters;
  pagination?: { page: number; pageSize: number };
  enabled?: boolean;
}

export function useInstalacoes(filtersOrParams?: InstalacaoFilters | UseInstalacoesParams) {
  // Suporte para ambas as assinaturas
  const isNewFormat = filtersOrParams && ('filters' in filtersOrParams || 'pagination' in filtersOrParams || 'enabled' in filtersOrParams);
  
  const filters = isNewFormat ? (filtersOrParams as UseInstalacoesParams).filters : filtersOrParams as InstalacaoFilters | undefined;
  const pagination = isNewFormat ? (filtersOrParams as UseInstalacoesParams).pagination : undefined;
  const enabled = isNewFormat ? (filtersOrParams as UseInstalacoesParams).enabled ?? true : true;
  
  const page = pagination?.page ?? 1;
  const pageSize = pagination?.pageSize ?? 100;

  return useQuery({
    queryKey: ['instalacoes', filters, pagination],
    queryFn: async () => {
      let query = supabase
        .from('instalacoes')
        .select(`
          *,
          associados (id, nome, telefone, email),
          veiculos (id, marca, modelo, placa, ano_modelo, cor),
          rastreadores (id, codigo, numero_serie, imei),
          profiles:instalador_id (id, nome, telefone)
        `, { count: 'exact' })
        .order('data_agendada', { ascending: true });

      // Filtro por status
      if (filters?.status) {
        if (Array.isArray(filters.status) && filters.status.length > 0) {
          query = query.in('status', filters.status);
        } else if (typeof filters.status === 'string') {
          query = query.eq('status', filters.status);
        }
      }

      // Filtro por período
      if (filters?.periodo) {
        query = query.eq('periodo', filters.periodo);
      }

      // Filtro por instalador (suporta ambos formatos)
      const instaladorId = filters?.instaladorId || filters?.instalador_id;
      if (instaladorId) {
        query = query.eq('instalador_id', instaladorId);
      }

      // Filtro por datas (suporta ambos formatos)
      if (filters?.dataInicio) {
        query = query.gte('data_agendada', filters.dataInicio.toISOString().split('T')[0]);
      } else if (filters?.data_inicio) {
        query = query.gte('data_agendada', filters.data_inicio);
      }

      if (filters?.dataFim) {
        query = query.lte('data_agendada', filters.dataFim.toISOString().split('T')[0]);
      } else if (filters?.data_fim) {
        query = query.lte('data_agendada', filters.data_fim);
      }

      // Filtro sem instalador
      if (filters?.sem_instalador) {
        query = query.is('instalador_id', null);
      }

      // Paginação
      if (pagination) {
        query = query.range((page - 1) * pageSize, page * pageSize - 1);
      }

      const { data, error, count } = await query;

      if (error) throw error;

      let result = data as InstalacaoWithRelations[];

      // Filtro por busca no client side
      if (filters?.search) {
        const searchLower = filters.search.toLowerCase();
        result = result.filter(inst => 
          inst.associados?.nome?.toLowerCase().includes(searchLower) ||
          inst.veiculos?.placa?.toLowerCase().includes(searchLower)
        );
      }

      // Retorna formato com paginação se solicitado
      if (pagination) {
        return {
          instalacoes: result,
          pagination: {
            page,
            pageSize,
            total: count || 0,
            totalPages: Math.ceil((count || 0) / pageSize),
          },
        };
      }

      return result;
    },
    enabled,
  });
}

// ============================================
// HOOK: INSTALAÇÃO INDIVIDUAL
// ============================================
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

// ============================================
// HOOK: CONTAGEM DE INSTALAÇÕES
// ============================================
export function useInstalacoesContagem(data?: string) {
  return useQuery({
    queryKey: ['instalacoes-contagem', data],
    queryFn: async () => {
      const hoje = data || new Date().toISOString().split('T')[0];

      const { data: instalacoes, error } = await supabase
        .from('instalacoes')
        .select('status, data_agendada, updated_at');

      if (error) throw error;

      const contagem: ContagemInstalacoes = {
        total: instalacoes.length,
        agendadas: 0,
        em_rota: 0,
        em_andamento: 0,
        concluidas_hoje: 0,
        reagendadas: 0,
        canceladas: 0,
      };

      instalacoes.forEach((inst) => {
        if (inst.status === 'agendada') contagem.agendadas++;
        if (inst.status === 'em_rota') contagem.em_rota++;
        if (inst.status === 'em_andamento') contagem.em_andamento++;
        if (inst.status === 'concluida') {
          const updatedDate = inst.updated_at?.split('T')[0];
          if (updatedDate === hoje) contagem.concluidas_hoje++;
        }
        if (inst.status === 'reagendada') contagem.reagendadas++;
        if (inst.status === 'cancelada') contagem.canceladas++;
      });

      return contagem;
    },
    refetchInterval: 30000,
  });
}

// ============================================
// HOOK: MÉTRICAS PARA DASHBOARD
// ============================================
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

      // Em rota ou em andamento
      const { count: emRota } = await supabase
        .from('instalacoes')
        .select('*', { count: 'exact', head: true })
        .in('status', ['em_rota', 'em_andamento']);

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

// ============================================
// HOOK: INSTALAÇÕES DO DIA
// ============================================
export function useInstalacoesDoDia(data?: string) {
  const dataFiltro = data || new Date().toISOString().split('T')[0];

  return useQuery({
    queryKey: ['instalacoes-dia', dataFiltro],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('instalacoes')
        .select(`
          *,
          associados (id, nome, telefone),
          veiculos (id, placa, marca, modelo),
          profiles:instalador_id (id, nome, telefone)
        `)
        .eq('data_agendada', dataFiltro)
        .order('periodo', { ascending: true });

      if (error) throw error;
      return data as InstalacaoWithRelations[];
    },
  });
}

// ============================================
// HOOK: INSTALAÇÕES POR INSTALADOR
// ============================================
export function useInstalacoesPorInstalador(instaladorId: string | undefined, data?: string) {
  return useQuery({
    queryKey: ['instalacoes-instalador', instaladorId, data],
    queryFn: async () => {
      if (!instaladorId) throw new Error('ID do instalador não informado');

      let query = supabase
        .from('instalacoes')
        .select(`
          *,
          associados (id, nome, telefone),
          veiculos (id, placa, marca, modelo)
        `)
        .eq('instalador_id', instaladorId)
        .order('data_agendada', { ascending: true })
        .order('periodo', { ascending: true });

      if (data) {
        query = query.eq('data_agendada', data);
      }

      const { data: instalacoes, error } = await query;
      if (error) throw error;
      return instalacoes as InstalacaoWithRelations[];
    },
    enabled: !!instaladorId,
  });
}

// ============================================
// HOOK: INSTALADORES - Re-exportado de useRotas
// ============================================
// NOTA: useInstaladores foi unificado em useRotas.ts para evitar
// conflito de cache do React Query. Use: import { useInstaladores } from '@/hooks/useRotas'

// ============================================
// HOOK: RASTREADORES EM ESTOQUE
// ============================================
export function useRastreadoresEstoque() {
  return useQuery({
    queryKey: ['rastreadores-estoque'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('rastreadores')
        .select('id, codigo, numero_serie, imei, status')
        .eq('status', 'estoque')
        .order('codigo', { ascending: true });

      if (error) throw error;
      return data ?? [];
    },
  });
}

// ============================================
// HOOK: AÇÕES DE INSTALAÇÃO (UNIFICADO)
// ============================================
export function useInstalacaoActions() {
  const queryClient = useQueryClient();

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: ['instalacoes'] });
    queryClient.invalidateQueries({ queryKey: ['instalacao'] });
    queryClient.invalidateQueries({ queryKey: ['instalacoes-contagem'] });
    queryClient.invalidateQueries({ queryKey: ['instalacoes-metricas'] });
    queryClient.invalidateQueries({ queryKey: ['instalacoes-dia'] });
    queryClient.invalidateQueries({ queryKey: ['instalacoes-instalador'] });
  };

  // Agendar/Criar instalação
  const agendarInstalacao = useMutation({
    mutationFn: async (payload: InstalacaoInsert) => {
      const { data, error } = await supabase
        .from('instalacoes')
        .insert({ ...payload, status: payload.status || 'agendada' })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      invalidateAll();
      toast.success('Instalação agendada!');
    },
    onError: () => toast.error('Erro ao agendar instalação'),
  });

  // Atribuir instalador
  const atribuirInstalador = useMutation({
    mutationFn: async ({ 
      instalacao_id, 
      instalador_id, 
      rastreador_id 
    }: { 
      instalacao_id: string; 
      instalador_id: string; 
      rastreador_id?: string;
    }) => {
      const updateData: InstalacaoUpdate = {
        instalador_id,
        status: 'agendada',
      };

      if (rastreador_id) {
        updateData.rastreador_id = rastreador_id;
      }

      const { error } = await supabase
        .from('instalacoes')
        .update(updateData)
        .eq('id', instalacao_id);

      if (error) throw error;
    },
    onSuccess: () => {
      invalidateAll();
      queryClient.invalidateQueries({ queryKey: ['rastreadores'] });
      toast.success('Instalador atribuído!');
    },
    onError: () => toast.error('Erro ao atribuir instalador'),
  });

  // Iniciar rota
  const iniciarRota = useMutation({
    mutationFn: async (instalacaoId: string) => {
      const { error } = await supabase
        .from('instalacoes')
        .update({ status: 'em_rota' })
        .eq('id', instalacaoId);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidateAll();
      toast.success('Instalador a caminho!');
    },
    onError: () => toast.error('Erro ao iniciar rota'),
  });

  // Iniciar instalação (com timestamp)
  const iniciarInstalacao = useMutation({
    mutationFn: async (instalacaoId: string) => {
      const { error } = await supabase
        .from('instalacoes')
        .update({ 
          status: 'em_andamento',
          iniciada_em: new Date().toISOString()
        })
        .eq('id', instalacaoId);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidateAll();
      toast.success('Instalação iniciada!');
    },
    onError: () => toast.error('Erro ao iniciar instalação'),
  });

  // Concluir instalação (com timestamp)
  const concluirInstalacao = useMutation({
    mutationFn: async ({ 
      instalacao_id, 
      rastreador_id,
      observacoes 
    }: { 
      instalacao_id: string; 
      rastreador_id: string;
      observacoes?: string;
    }) => {
      const updateData: InstalacaoUpdate = { 
        status: 'concluida',
        concluida_em: new Date().toISOString()
      };
      if (observacoes) updateData.observacoes = observacoes;

      const { error: errInst } = await supabase
        .from('instalacoes')
        .update(updateData)
        .eq('id', instalacao_id);

      if (errInst) throw errInst;

      const { error: errRast } = await supabase
        .from('rastreadores')
        .update({ status: 'instalado' })
        .eq('id', rastreador_id);

      if (errRast) throw errRast;
    },
    onSuccess: () => {
      invalidateAll();
      queryClient.invalidateQueries({ queryKey: ['rastreadores'] });
      toast.success('Instalação concluída!');
    },
    onError: () => toast.error('Erro ao concluir instalação'),
  });

  // Reagendar
  const reagendarInstalacao = useMutation({
    mutationFn: async ({ 
      instalacao_id, 
      nova_data, 
      novo_periodo,
      motivo 
    }: { 
      instalacao_id: string; 
      nova_data: string; 
      novo_periodo?: string;
      motivo?: string;
    }) => {
      const updateData: InstalacaoUpdate = {
        data_agendada: nova_data,
        status: 'reagendada',
      };

      if (novo_periodo) {
        updateData.periodo = novo_periodo as Instalacao['periodo'];
      }

      if (motivo) {
        updateData.observacoes = motivo;
      }

      const { error } = await supabase
        .from('instalacoes')
        .update(updateData)
        .eq('id', instalacao_id);

      if (error) throw error;
    },
    onSuccess: () => {
      invalidateAll();
      toast.success('Instalação reagendada!');
    },
    onError: () => toast.error('Erro ao reagendar'),
  });

  // Cancelar
  const cancelarInstalacao = useMutation({
    mutationFn: async ({ id, motivo }: { id: string; motivo?: string }) => {
      const { data: inst } = await supabase
        .from('instalacoes')
        .select('rastreador_id')
        .eq('id', id)
        .single();

      if (inst?.rastreador_id) {
        await supabase
          .from('rastreadores')
          .update({ status: 'estoque' })
          .eq('id', inst.rastreador_id);
      }

      const updateData: InstalacaoUpdate = { status: 'cancelada' };
      if (motivo) updateData.observacoes = motivo;

      const { error } = await supabase
        .from('instalacoes')
        .update(updateData)
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      invalidateAll();
      queryClient.invalidateQueries({ queryKey: ['rastreadores'] });
      toast.success('Instalação cancelada');
    },
    onError: () => toast.error('Erro ao cancelar'),
  });

  return {
    agendarInstalacao: agendarInstalacao.mutate,
    atribuirInstalador: atribuirInstalador.mutate,
    iniciarRota: iniciarRota.mutate,
    iniciarInstalacao: iniciarInstalacao.mutate,
    concluirInstalacao: concluirInstalacao.mutate,
    reagendarInstalacao: reagendarInstalacao.mutate,
    cancelarInstalacao: cancelarInstalacao.mutate,
    isAgendando: agendarInstalacao.isPending,
    isAtribuindo: atribuirInstalador.isPending,
    isIniciandoRota: iniciarRota.isPending,
    isIniciando: iniciarInstalacao.isPending,
    isConcluindo: concluirInstalacao.isPending,
    isReagendando: reagendarInstalacao.isPending,
    isCancelando: cancelarInstalacao.isPending,
  };
}

// ============================================
// HOOKS LEGADOS (compatibilidade)
// ============================================
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
      toast.success('Instalação criada com sucesso!');
    },
    onError: () => {
      toast.error('Erro ao criar instalação');
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
      toast.success('Instalação atualizada!');
    },
    onError: () => {
      toast.error('Erro ao atualizar instalação');
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
      toast.success('Status atualizado!');
    },
    onError: () => {
      toast.error('Erro ao atualizar status');
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
      toast.success('Instalação removida!');
    },
    onError: () => {
      toast.error('Erro ao remover instalação');
    },
  });
}
